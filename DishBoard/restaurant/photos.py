"""Restaurant photo defaults and upload boundary."""
import cloudinary.uploader

DEFAULT_PHOTO_URL = "https://res.cloudinary.com/drlmg8tzf/image/upload/v1736885696/py7lepbjsndwwwt7nszs.jpg"


def photo_url_for_upload(image_file):
    if image_file:
        return cloudinary.uploader.upload(image_file).get("secure_url")
    return DEFAULT_PHOTO_URL
