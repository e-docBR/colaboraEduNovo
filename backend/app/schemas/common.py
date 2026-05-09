"""Common marshmallow schemas."""
from marshmallow import Schema, fields


class PaginationSchema(Schema):
    page = fields.Int(load_default=1)
    per_page = fields.Int(load_default=20)
