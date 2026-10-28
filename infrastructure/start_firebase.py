"""Start the selected Firebase API without an extra shell or quoting layer."""
import os


def command(environment):
    service = environment.get("SERVICE")
    port = environment.get("PORT", "8000")
    if not port.isdecimal() or not 1 <= int(port) <= 65535:
        raise ValueError("PORT must be between 1 and 65535")
    if service == "OrderLine":
        return ["uvicorn", "firebase_main:app", "--host", "0.0.0.0",
                "--port", port, "--workers", "1"]
    module = {"UserBase": "user_base", "DishBoard": "dish_board"}.get(service)
    if module is None:
        raise ValueError("SERVICE must be UserBase, DishBoard, or OrderLine")
    environment["DJANGO_SETTINGS_MODULE"] = module + ".firebase_settings"
    return ["gunicorn", "--bind", "0.0.0.0:" + port, "--workers", "1",
            "--threads", "4", "--timeout", "120", module + ".wsgi:application"]


if __name__ == "__main__":
    arguments = command(os.environ)
    os.execvp(arguments[0], arguments)
