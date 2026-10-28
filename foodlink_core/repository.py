"""Small Firestore helpers; business transactions remain in their services."""
import random
import re
from threading import Lock
import time

from google.api_core.exceptions import Aborted, DeadlineExceeded, NotFound, ServiceUnavailable
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from .firebase import db

MAX_ID = 2**53 - 1
_counter_locks = {}
_counter_locks_guard = Lock()
_COUNTER_ATTEMPTS = 8


def _counter_lock(collection):
    # A numeric counter is necessarily a hot document. Coordinate threads in
    # this worker while Firestore transactions still protect across workers.
    with _counter_locks_guard:
        return _counter_locks.setdefault(collection, Lock())


def _transient_counter_error(error):
    # The SDK wraps exhausted transaction Aborted errors in ValueError.
    seen = set()
    while error is not None and id(error) not in seen:
        seen.add(id(error))
        if isinstance(error, (Aborted, DeadlineExceeded, ServiceUnavailable)):
            return True
        error = error.__cause__
    return False


def _counter_transaction(client, collection, reserve):
    with _counter_lock(collection):
        for attempt in range(_COUNTER_ATTEMPTS):
            try:
                # The SDK itself retries Aborted immediately. Own the bounded
                # retry here so each fresh transaction gets jittered backoff.
                transaction = client.transaction(max_attempts=1)
                return firestore.transactional(reserve)(transaction)
            except (Aborted, DeadlineExceeded, ServiceUnavailable, ValueError) as error:
                if not _transient_counter_error(error) or attempt == _COUNTER_ATTEMPTS - 1:
                    raise
                delay = min(0.05 * 2**attempt, 1.0)
                time.sleep(random.uniform(delay / 2, delay))


class NotFoundError(LookupError):
    pass


def _collection(name):
    if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,63}', name):
        raise ValueError('Invalid entity collection name')
    return name


def _document_id(value):
    if isinstance(value, bool) or not isinstance(value, (str, int)) or not str(value) or '/' in str(value):
        raise ValueError('Invalid document ID')
    return str(value)


def document_data(snapshot, numeric_id=True):
    if not snapshot.exists:
        raise NotFoundError('Document not found')
    value = dict(snapshot.to_dict())
    identifier = snapshot.id
    value['id'] = int(identifier) if numeric_id and identifier.isdigit() else identifier
    return value


def reserve_ids(collection, count, transaction=None):
    collection = _collection(collection)
    if isinstance(count, bool) or not isinstance(count, int) or count < 1:
        raise ValueError('ID count must be a positive integer')
    client = db()

    def reserve(active):
        reference = client.collection('_counters').document(collection)
        snapshot = reference.get(transaction=active)
        current = snapshot.to_dict().get('value', 0) if snapshot.exists else 0
        if isinstance(current, bool) or not isinstance(current, int) or current < 0 or current + count > MAX_ID:
            raise ValueError('Invalid or exhausted numeric ID counter')
        active.set(reference, {'value': current + count})
        return list(range(current + 1, current + count + 1))

    if transaction is not None:
        return reserve(transaction)
    return _counter_transaction(client, collection, reserve)


def allocate_id(collection, transaction=None):
    """With a supplied transaction, finish every other read before calling this."""
    return reserve_ids(collection, 1, transaction)[0]


def get_document(collection, document_id):
    reference = db().collection(_collection(collection)).document(_document_id(document_id))
    return document_data(reference.get(), collection != 'users')


def create_document(collection, data, document_id=None):
    client = db()
    collection = _collection(collection)
    document_id = allocate_id(collection) if document_id is None else document_id
    reference = client.collection(collection).document(_document_id(document_id))
    value = dict(data)
    value.pop('id', None)
    reference.create(value)
    return document_data(reference.get(), collection != 'users')


def update_document(collection, document_id, changes):
    reference = db().collection(_collection(collection)).document(_document_id(document_id))
    value = dict(changes)
    value.pop('id', None)
    try:
        reference.update(value)
    except NotFound as error:
        raise NotFoundError('Document not found') from error
    return document_data(reference.get(), collection != 'users')


def delete_document(collection, document_id):
    reference = db().collection(_collection(collection)).document(_document_id(document_id))
    snapshot = reference.get()
    if not snapshot.exists:
        raise NotFoundError('Document not found')
    reference.delete()


def list_documents(collection, filters=(), order_by=None, limit=None):
    query = db().collection(_collection(collection))
    for field, operator, value in filters:
        query = query.where(filter=FieldFilter(field, operator, value))
    if order_by:
        field, direction = (order_by, 'ASCENDING') if isinstance(order_by, str) else order_by
        if direction not in ('ASCENDING', 'DESCENDING'):
            raise ValueError('Invalid query direction')
        query = query.order_by(field, direction=direction)
    if limit is not None:
        if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1:
            raise ValueError('Query limit must be a positive integer')
        query = query.limit(limit)
    return [document_data(snapshot, collection != 'users') for snapshot in query.stream()]
