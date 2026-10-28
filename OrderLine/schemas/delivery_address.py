"""Order-local address snapshots remain independent of the saved address book."""
from pydantic import BaseModel, ConfigDict, Field, field_validator


class DeliveryAddress(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='ignore')
    label: str = Field(default='', max_length=40)
    city: str = Field(min_length=1, max_length=100)
    street_name: str = Field(min_length=1, max_length=150)
    house_number: str = Field(min_length=1, max_length=20)

    @field_validator('house_number', mode='before')
    @classmethod
    def stringify_house_number(cls, value):
        return str(value) if isinstance(value, int) and not isinstance(value, bool) else value
