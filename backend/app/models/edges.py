from datetime import datetime

from pydantic import BaseModel

from app.models.fields import RelationType, Weight


class EdgeCreate(BaseModel):
    source_id: str
    target_id: str
    relation_type: RelationType
    weight: Weight = 1.0


class EdgeOut(BaseModel):
    id: str
    source_id: str
    target_id: str
    relation_type: RelationType
    weight: float
    created_at: datetime
