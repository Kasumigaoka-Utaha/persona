from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEFAULT_AUDIENCES
from app.models import AudienceDefinition


def seed_reference_data(db: Session) -> None:
    existing = {row[0] for row in db.execute(select(AudienceDefinition.key)).all()}
    for audience in DEFAULT_AUDIENCES:
        if audience["key"] not in existing:
            db.add(AudienceDefinition(**audience))
    db.commit()
