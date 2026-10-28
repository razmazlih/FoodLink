"""Opening-hours calculations shared by restaurant API views."""
from .models import OpeningHours


def is_open_at(hours, current_time):
    return bool(hours and hours.is_open and
                hours.opening_time <= current_time <= hours.closing_time)


def next_opening_time(restaurant_id, current_day):
    days = [day for day, _ in OpeningHours.DAYS_OF_WEEK]
    current_index = days.index(current_day)
    for offset in range(1, 8):
        day = days[(current_index + offset) % 7]
        hours = OpeningHours.objects.filter(
            restaurant_id=restaurant_id, day_of_week=day, is_open=True
        ).first()
        if hours:
            return {"day_of_week": day, "opening_time": hours.opening_time}
    return None
