"""
Segment Engine — translates JSONB filter_rules into SQLAlchemy WHERE clauses.

Filter rule schema:
{
  "operator": "AND" | "OR",
  "conditions": [
    { "field": "<field>", "op": "<op>", "value": <value> }
  ]
}

Supported fields:
  total_spent           → customers.total_spent
  days_since_last_order → EXTRACT(DAY FROM NOW() - customers.last_order_at)
  loyalty_tier          → customers.loyalty_tier
  city                  → customers.city
  created_days_ago      → EXTRACT(DAY FROM NOW() - customers.created_at)

Supported operators: gt, lt, gte, lte, eq, neq, in, not_in
"""

from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer

# Whitelist of allowed fields → SQL expression strings
FIELD_MAP = {
    "total_spent": "customers.total_spent",
    "days_since_last_order": "EXTRACT(DAY FROM NOW() - customers.last_order_at)",
    "loyalty_tier": "customers.loyalty_tier",
    "city": "customers.city",
    "created_days_ago": "EXTRACT(DAY FROM NOW() - customers.created_at)",
}

# Operator mapping
OP_MAP = {
    "gt": ">",
    "lt": "<",
    "gte": ">=",
    "lte": "<=",
    "eq": "=",
    "neq": "!=",
}


def validate_filter_rules(rules: dict) -> bool:
    """Validate filter rules structure and fields against whitelist."""
    if "conditions" not in rules:
        return False
    for cond in rules["conditions"]:
        if not isinstance(cond, dict):
            raise ValueError("Each condition must be an object with field, op, value")
        if cond.get("field") not in FIELD_MAP:
            return False
        op = cond.get("op")
        if op not in {*OP_MAP.keys(), "in", "not_in"}:
            return False
    return True


def build_where_clause(rules: dict) -> str:
    """Convert filter rules dict to a SQL WHERE clause string."""
    operator = rules.get("operator", "AND").upper()
    if operator not in ("AND", "OR"):
        operator = "AND"

    conditions = []
    for cond in rules["conditions"]:
        field = cond["field"]
        op = cond["op"]
        value = cond["value"]

        sql_field = FIELD_MAP[field]

        if op in ("in", "not_in"):
            sql_op = "IN" if op == "in" else "NOT IN"
            if isinstance(value, list):
                quoted = ", ".join(f"'{v}'" for v in value)
                conditions.append(f"{sql_field} {sql_op} ({quoted})")
            else:
                conditions.append(f"{sql_field} {sql_op} ('{value}')")
        elif op in OP_MAP:
            sql_op = OP_MAP[op]
            if isinstance(value, str):
                conditions.append(f"{sql_field} {sql_op} '{value}'")
            else:
                conditions.append(f"{sql_field} {sql_op} {value}")

    if not conditions:
        return "1=1"

    return f" {operator} ".join(conditions)


async def evaluate_segment(db: AsyncSession, filter_rules: dict) -> tuple[int, list]:
    """
    Run the segment filter against the customers table.
    Returns (count, sample_list_of_5).
    """
    where_clause = build_where_clause(filter_rules)

    count_sql = text(f"SELECT COUNT(*) FROM customers WHERE {where_clause}")
    sample_sql = text(
        f"""
        SELECT id, name, email, city, loyalty_tier, total_spent, last_order_at
        FROM customers
        WHERE {where_clause}
        LIMIT 5
        """
    )

    count_result = await db.execute(count_sql)
    count = count_result.scalar()

    sample_result = await db.execute(sample_sql)
    rows = sample_result.mappings().all()
    sample = [
        {
            "id": str(row["id"]),
            "name": row["name"],
            "email": row["email"],
            "city": row["city"],
            "loyalty_tier": row["loyalty_tier"],
            "total_spent": float(row["total_spent"] or 0),
        }
        for row in rows
    ]

    return count, sample


async def get_segment_customer_ids(db: AsyncSession, filter_rules: dict) -> list[str]:
    """Return all customer IDs matching the segment filter."""
    where_clause = build_where_clause(filter_rules)
    sql = text(f"SELECT id FROM customers WHERE {where_clause}")
    result = await db.execute(sql)
    return [str(row[0]) for row in result.fetchall()]
