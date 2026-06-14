"""Analytics service — aggregates comm_events per campaign."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_campaign_analytics(db: AsyncSession, campaign_id: str) -> dict:
    """
    Aggregate comm_events counts for a campaign.
    Uses PostgreSQL FILTER clause for efficient single-pass aggregation.
    """
    sql = text(
        """
        SELECT
          COUNT(*) FILTER (WHERE status = 'sent')      AS sent,
          COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
          COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
          COUNT(*) FILTER (WHERE status = 'opened')    AS opened,
          COUNT(*) FILTER (WHERE status = 'clicked')   AS clicked
        FROM comm_events
        WHERE campaign_id = :campaign_id
        """
    )
    result = await db.execute(sql, {"campaign_id": campaign_id})
    row = result.mappings().one()

    sent = row["sent"] or 0
    delivered = row["delivered"] or 0
    failed = row["failed"] or 0
    opened = row["opened"] or 0
    clicked = row["clicked"] or 0

    delivery_rate = round(delivered / sent, 4) if sent > 0 else 0.0
    open_rate = round(opened / delivered, 4) if delivered > 0 else 0.0
    click_rate = round(clicked / opened, 4) if opened > 0 else 0.0

    return {
        "campaign_id": campaign_id,
        "sent": sent,
        "delivered": delivered,
        "failed": failed,
        "opened": opened,
        "clicked": clicked,
        "delivery_rate": delivery_rate,
        "open_rate": open_rate,
        "click_rate": click_rate,
    }


async def get_all_campaigns_analytics(db: AsyncSession) -> dict:
    """Aggregate analytics across all campaigns for dashboard KPIs."""
    sql = text(
        """
        SELECT
          COUNT(DISTINCT campaign_id)                  AS total_campaigns,
          COUNT(*) FILTER (WHERE status = 'sent')      AS total_sent,
          COUNT(*) FILTER (WHERE status = 'delivered') AS total_delivered,
          COUNT(*) FILTER (WHERE status = 'opened')    AS total_opened,
          COUNT(*) FILTER (WHERE status = 'clicked')   AS total_clicked
        FROM comm_events
        """
    )
    result = await db.execute(sql)
    row = result.mappings().one()

    total_sent = row["total_sent"] or 0
    total_delivered = row["total_delivered"] or 0
    total_opened = row["total_opened"] or 0

    return {
        "total_campaigns": row["total_campaigns"] or 0,
        "total_sent": total_sent,
        "total_delivered": total_delivered,
        "total_opened": total_opened,
        "total_clicked": row["total_clicked"] or 0,
        "avg_delivery_rate": round(total_delivered / total_sent, 4) if total_sent > 0 else 0.0,
        "avg_open_rate": round(total_opened / total_delivered, 4) if total_delivered > 0 else 0.0,
    }
