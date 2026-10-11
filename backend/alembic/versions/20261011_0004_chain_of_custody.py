"""Chain of custody: custody_events (append-only), custody_transfers and
evidence.custodian_id. Backfills a REGISTERED event and the custodian for evidence
uploaded before custody tracking, from its "uploaded" audit entry.

Revision ID: 0004
Revises: 0003
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

BACKFILL_NOTE = "Backfilled from the upload audit entry when custody tracking was added."


def upgrade():
    op.create_table(
        "custody_transfers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("evidence_id", sa.Integer(), sa.ForeignKey("evidence.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("from_investigator_id", sa.Integer(), sa.ForeignKey("investigators.id", ondelete="SET NULL")),
        sa.Column("to_investigator_id", sa.Integer(), sa.ForeignKey("investigators.id", ondelete="SET NULL")),
        sa.Column("initiated_by_id", sa.Integer(), sa.ForeignKey("investigators.id", ondelete="SET NULL")),
        sa.Column("from_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("to_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("initiated_by_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime()),
        sa.Column("resolved_by_id", sa.Integer(), sa.ForeignKey("investigators.id", ondelete="SET NULL")),
    )
    op.create_index("ix_custody_transfers_evidence_id", "custody_transfers", ["evidence_id"])
    op.create_index("ix_custody_transfers_status", "custody_transfers", ["status"])
    op.create_index(
        "uq_custody_transfers_pending",
        "custody_transfers",
        ["evidence_id"],
        unique=True,
        sqlite_where=sa.text("status = 'PENDING'"),
        postgresql_where=sa.text("status = 'PENDING'"),
    )

    op.create_table(
        "custody_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("evidence_id", sa.Integer(), sa.ForeignKey("evidence.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("case_id", sa.Integer(), sa.ForeignKey("cases.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("investigators.id", ondelete="SET NULL")),
        sa.Column("actor_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("from_custodian_id", sa.Integer(), sa.ForeignKey("investigators.id", ondelete="SET NULL")),
        sa.Column("from_custodian_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("to_custodian_id", sa.Integer(), sa.ForeignKey("investigators.id", ondelete="SET NULL")),
        sa.Column("to_custodian_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("transfer_id", sa.Integer(), sa.ForeignKey("custody_transfers.id", ondelete="SET NULL")),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("sha256", sa.String(64)),
        sa.Column("expected_sha256", sa.String(64)),
        sa.Column("integrity_result", sa.String(16)),
        sa.Column("at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_custody_events_case_id", "custody_events", ["case_id"])
    op.create_index("ix_custody_events_evidence_at", "custody_events", ["evidence_id", "at", "id"])

    with op.batch_alter_table("evidence") as batch:
        batch.add_column(sa.Column("custodian_id", sa.Integer()))
        batch.create_foreign_key(
            "fk_evidence_custodian_id_investigators", "investigators", ["custodian_id"], ["id"], ondelete="SET NULL"
        )

    # Backfill: whoever uploaded each item registered it and holds it. Items with no
    # upload entry are registered with no actor and no custodian.
    op.execute(
        f"""
        INSERT INTO custody_events
            (evidence_id, case_id, action, actor_id, actor_name, from_custodian_name,
             to_custodian_id, to_custodian_name, note, sha256, at)
        SELECT e.id, e.case_id, 'REGISTERED', up.actor_id, COALESCE(i.name, ''), '',
               up.actor_id, COALESCE(i.name, ''), '{BACKFILL_NOTE}', NULLIF(e.sha256, ''),
               COALESCE(up.at, e.created_at)
        FROM evidence e
        LEFT JOIN (
            SELECT a.record_id, a.actor_id, a.at FROM audit_log a
            WHERE a.record_type = 'evidence' AND a.action = 'uploaded'
              AND a.id = (SELECT MIN(b.id) FROM audit_log b
                          WHERE b.record_type = 'evidence' AND b.action = 'uploaded' AND b.record_id = a.record_id)
        ) up ON up.record_id = e.id
        LEFT JOIN investigators i ON i.id = up.actor_id
        ORDER BY e.id
        """
    )
    op.execute(
        """
        UPDATE evidence SET custodian_id = (
            SELECT ce.to_custodian_id FROM custody_events ce
            WHERE ce.evidence_id = evidence.id AND ce.action = 'REGISTERED'
        )
        """
    )


def downgrade():
    # The custody tables reference evidence, so they go before evidence is rebuilt.
    op.drop_table("custody_events")
    op.drop_table("custody_transfers")
    with op.batch_alter_table("evidence") as batch:
        batch.drop_constraint("fk_evidence_custodian_id_investigators", type_="foreignkey")
        batch.drop_column("custodian_id")
