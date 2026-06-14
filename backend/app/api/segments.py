from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.segment import Segment
from app.schemas.segment import SegmentCreate, SegmentOut, SegmentPreviewResponse
from app.services.segment_engine import evaluate_segment, validate_filter_rules

router = APIRouter(tags=["segments"])


@router.post("/segments", response_model=SegmentOut, status_code=201)
async def create_segment(payload: SegmentCreate, db: AsyncSession = Depends(get_db)):
    if not validate_filter_rules(payload.filter_rules):
        raise HTTPException(422, "Invalid filter_rules: unknown field or operator")
    segment = Segment(**payload.model_dump())
    db.add(segment)
    await db.commit()
    await db.refresh(segment)
    return segment


@router.get("/segments", response_model=list[SegmentOut])
async def list_segments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Segment).order_by(Segment.created_at.desc()))
    return result.scalars().all()


@router.get("/segments/{segment_id}", response_model=SegmentOut)
async def get_segment(segment_id: str, db: AsyncSession = Depends(get_db)):
    segment = await db.get(Segment, segment_id)
    if not segment:
        raise HTTPException(404, "Segment not found")
    return segment


@router.get("/segments/{segment_id}/preview", response_model=SegmentPreviewResponse)
async def preview_segment(segment_id: str, db: AsyncSession = Depends(get_db)):
    segment = await db.get(Segment, segment_id)
    if not segment:
        raise HTTPException(404, "Segment not found")
    count, sample = await evaluate_segment(db, segment.filter_rules)
    return {"count": count, "sample": sample}
