"""
Seed script — generates realistic demo data for the Xeno CRM.

Generates:
  - 500 customers (Indian names, cities, loyalty tiers)
  - 2,000 orders distributed over 180 days
  - 3 pre-built segments
  - 2 completed campaigns with simulated analytics

Run from backend/ directory:
  python seed/seed_data.py
"""
import asyncio
import random
import sys
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from faker import Faker
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Load env
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

fake = Faker("en_IN")

CATEGORIES = ["Clothing", "Electronics", "Beauty", "Home & Kitchen", "Sports", "Books", "Food & Grocery", "Jewelry"]
CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad",
          "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal", "Coimbatore", "Kochi"]
TIERS = ["bronze", "silver", "gold", "platinum"]

NOW = datetime.now(timezone.utc)


def get_loyalty_tier(total_spent: float) -> str:
    if total_spent >= 25000:
        return "platinum"
    elif total_spent >= 10000:
        return "gold"
    elif total_spent >= 3000:
        return "silver"
    return "bronze"


async def seed(db: AsyncSession):
    print("[SEED] Starting seed...")

    # ── TRUNCATE existing data ─────────────────────────────────────────────
    await db.execute(text("TRUNCATE comm_events, campaigns, segments, orders, customers, dlq_events RESTART IDENTITY CASCADE"))
    await db.commit()
    print("[OK] Cleared existing data")

    # ── Generate customers ─────────────────────────────────────────────────
    customer_rows = []
    for i in range(500):
        # Create a spend value that determines tier
        # Distribute: 200 bronze, 150 silver, 100 gold, 50 platinum
        if i < 200:
            total_spent = round(random.uniform(200, 2999), 2)
        elif i < 350:
            total_spent = round(random.uniform(3000, 9999), 2)
        elif i < 450:
            total_spent = round(random.uniform(10000, 24999), 2)
        else:
            total_spent = round(random.uniform(25000, 80000), 2)

        tier = get_loyalty_tier(total_spent)
        days_ago = random.randint(0, 180)
        last_order_at = NOW - timedelta(days=days_ago) if random.random() > 0.05 else None
        created_at = NOW - timedelta(days=random.randint(days_ago, 365))

        customer_rows.append({
            "name": fake.name(),
            "email": fake.unique.email(),
            "phone": fake.phone_number()[:15],
            "city": random.choice(CITIES),
            "loyalty_tier": tier,
            "total_spent": total_spent,
            "last_order_at": last_order_at,
            "created_at": created_at,
        })

    customer_insert_sql = text("""
        INSERT INTO customers (name, email, phone, city, loyalty_tier, total_spent, last_order_at, created_at)
        VALUES (:name, :email, :phone, :city, :loyalty_tier, :total_spent, :last_order_at, :created_at)
        RETURNING id
    """)

    customer_ids = []
    for row in customer_rows:
        result = await db.execute(customer_insert_sql, row)
        customer_ids.append(str(result.scalar()))

    await db.commit()
    print(f"[OK] Inserted {len(customer_ids)} customers")

    # ── Generate orders ────────────────────────────────────────────────────
    order_rows = []
    for _ in range(2000):
        customer_id = random.choice(customer_ids)
        days_ago = random.randint(0, 180)
        ordered_at = NOW - timedelta(days=days_ago, hours=random.randint(0, 23))
        amount = round(random.uniform(150, 8000), 2)

        order_rows.append({
            "customer_id": customer_id,
            "amount": amount,
            "product_category": random.choice(CATEGORIES),
            "ordered_at": ordered_at,
        })

    order_insert_sql = text("""
        INSERT INTO orders (customer_id, amount, product_category, ordered_at)
        VALUES (:customer_id, :amount, :product_category, :ordered_at)
    """)
    await db.execute(order_insert_sql, order_rows)
    await db.commit()
    print("[OK] Inserted 2000 orders")

    # ── Pre-built segments ─────────────────────────────────────────────────
    segments = [
        {
            "name": "High Value (Gold+)",
            "filter_rules": {
                "operator": "AND",
                "conditions": [
                    {"field": "loyalty_tier", "op": "in", "value": ["gold", "platinum"]}
                ]
            },
            "created_by_ai": False,
            "nl_query": None,
        },
        {
            "name": "Churned (90d Inactive)",
            "filter_rules": {
                "operator": "AND",
                "conditions": [
                    {"field": "days_since_last_order", "op": "gt", "value": 90}
                ]
            },
            "created_by_ai": False,
            "nl_query": None,
        },
        {
            "name": "New Customers (Last 30d)",
            "filter_rules": {
                "operator": "AND",
                "conditions": [
                    {"field": "created_days_ago", "op": "lte", "value": 30}
                ]
            },
            "created_by_ai": False,
            "nl_query": None,
        },
    ]

    segment_ids = []
    seg_insert = text("""
        INSERT INTO segments (name, filter_rules, created_by_ai, nl_query)
        VALUES (:name, cast(:filter_rules as jsonb), :created_by_ai, :nl_query)
        RETURNING id
    """)
    import json
    for seg in segments:
        seg_copy = dict(seg)
        seg_copy["filter_rules"] = json.dumps(seg["filter_rules"])
        result = await db.execute(seg_insert, seg_copy)
        segment_ids.append(str(result.scalar()))
    await db.commit()
    print(f"[OK] Inserted {len(segment_ids)} segments")

    # ── Pre-built completed campaigns ──────────────────────────────────────
    campaigns_data = [
        {
            "name": "Summer Win-Back Campaign",
            "segment_id": segment_ids[1],  # Churned
            "message": "Hey {name}! We miss you at Xeno Store 💙 Come back and enjoy 20% off your next order. Use code COMEBACK20. Valid for 7 days!",
            "channel": "whatsapp",
            "status": "completed",
            "launched_at": NOW - timedelta(days=14),
            "created_at": NOW - timedelta(days=15),
        },
        {
            "name": "Gold Tier Exclusive Offer",
            "segment_id": segment_ids[0],  # High Value
            "message": "Dear {name}, as a valued Gold member, you get early access to our new collection! Shop now at xeno.store/exclusive",
            "channel": "email",
            "status": "completed",
            "launched_at": NOW - timedelta(days=7),
            "created_at": NOW - timedelta(days=8),
        },
    ]

    campaign_ids = []
    camp_insert = text("""
        INSERT INTO campaigns (name, segment_id, message, channel, status, launched_at, created_at)
        VALUES (:name, cast(:segment_id as uuid), :message, :channel, :status, :launched_at, :created_at)
        RETURNING id
    """)
    for c in campaigns_data:
        result = await db.execute(camp_insert, c)
        campaign_ids.append(str(result.scalar()))
    await db.commit()
    print(f"[OK] Inserted {len(campaign_ids)} campaigns")

    # ── Generate comm_events for completed campaigns ───────────────────────
    # Use a sample of customers for the pre-built campaigns
    sample_customers = random.sample(customer_ids, min(100, len(customer_ids)))

    STATUSES = ["delivered"] * 70 + ["failed"] * 10 + ["pending"] * 20

    comm_event_rows = []
    for campaign_id in campaign_ids:
        for customer_id in sample_customers:
            outcome = random.choice(STATUSES)

            # sent event
            comm_event_rows.append({
                "campaign_id": campaign_id,
                "customer_id": customer_id,
                "channel": "whatsapp",
                "status": "sent",
                "idempotency_key": f"{campaign_id}:{customer_id}:sent",
            })

            if outcome == "delivered":
                comm_event_rows.append({
                    "campaign_id": campaign_id,
                    "customer_id": customer_id,
                    "channel": "whatsapp",
                    "status": "delivered",
                    "idempotency_key": f"{campaign_id}:{customer_id}:delivered",
                })
                # 50% open rate
                if random.random() < 0.50:
                    comm_event_rows.append({
                        "campaign_id": campaign_id,
                        "customer_id": customer_id,
                        "channel": "whatsapp",
                        "status": "opened",
                        "idempotency_key": f"{campaign_id}:{customer_id}:opened",
                    })
                    # 20% click rate
                    if random.random() < 0.20:
                        comm_event_rows.append({
                            "campaign_id": campaign_id,
                            "customer_id": customer_id,
                            "channel": "whatsapp",
                            "status": "clicked",
                            "idempotency_key": f"{campaign_id}:{customer_id}:clicked",
                        })
            elif outcome == "failed":
                comm_event_rows.append({
                    "campaign_id": campaign_id,
                    "customer_id": customer_id,
                    "channel": "whatsapp",
                    "status": "failed",
                    "idempotency_key": f"{campaign_id}:{customer_id}:failed",
                })

    if comm_event_rows:
        comm_insert = text("""
            INSERT INTO comm_events (campaign_id, customer_id, channel, status, idempotency_key)
            VALUES (:campaign_id, :customer_id, :channel, :status, :idempotency_key)
            ON CONFLICT (idempotency_key) DO NOTHING
        """)
        await db.execute(comm_insert, comm_event_rows)
        await db.commit()
    print(f"[OK] Inserted {len(comm_event_rows)} comm_events for pre-built campaigns")

    print("\n[DONE] Seed complete!")
    print(f"   Customers : 500")
    print(f"   Orders    : 2000")
    print(f"   Segments  : {len(segment_ids)}")
    print(f"   Campaigns : {len(campaign_ids)}")
    print(f"   CommEvents: {len(comm_event_rows)}")


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as db:
        await seed(db)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
