from pydantic import BaseModel


class TagOut(BaseModel):
    name: str
    count: int
