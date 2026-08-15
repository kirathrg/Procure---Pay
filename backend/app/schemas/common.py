from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for API schemas: fields are snake_case in Python but serialize
    as camelCase, matching the frontend's TypeScript field names exactly
    (e.g. reference_price -> referencePrice) so responses need no
    translation on the client side."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
