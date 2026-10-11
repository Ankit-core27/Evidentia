"""Medical detail metadata and reviewable non-traumatic anatomical findings.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("injuries", sa.Column("medical_details", sa.JSON(), nullable=False, server_default="{}"))
    op.create_table(
        "anatomy_findings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("case_id", sa.Integer(), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("person_id", sa.Integer(), sa.ForeignKey("persons.id", ondelete="SET NULL")),
        sa.Column("structure_id", sa.String(100)),
        sa.Column("body_region", sa.String(100), nullable=False),
        sa.Column("finding_type", sa.String(32), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("reported_condition", sa.Text(), nullable=False),
        sa.Column("medical_details", sa.JSON(), nullable=False),
        sa.Column("origin", sa.String(16), nullable=False, server_default="investigator"),
        sa.Column("review_status", sa.String(16), nullable=False, server_default="confirmed"),
    )
    for column in ("case_id", "person_id", "review_status"):
        op.create_index(f"ix_anatomy_findings_{column}", "anatomy_findings", [column])


def downgrade():
    op.drop_table("anatomy_findings")
    with op.batch_alter_table("injuries") as batch:
        batch.drop_column("medical_details")
