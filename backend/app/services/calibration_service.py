# from __future__ import annotations

# from sqlalchemy import select
# from sqlalchemy.ext.asyncio import AsyncSession

# from app.db.models import Calibration
# from app.detection.homography import HomographyTransformer


# async def save_calibration(
#     session: AsyncSession,
#     camera_id: str,
#     image_points: list[list[float]],
#     world_points: list[list[float]],
# ) -> Calibration:
#     if len(image_points) != 4 or len(world_points) != 4:
#         raise ValueError("Calibration requires exactly 4 image points and 4 world points")

#     matrix = HomographyTransformer.compute(image_points, world_points)

#     existing = await session.scalar(select(Calibration).where(Calibration.camera_id == camera_id))
#     if existing:
#         existing.image_points = image_points
#         existing.world_points = world_points
#         existing.homography_matrix = matrix.tolist()
#         await session.commit()
#         await session.refresh(existing)
#         return existing

#     row = Calibration(
#         camera_id=camera_id,
#         image_points=image_points,
#         world_points=world_points,
#         homography_matrix=matrix.tolist(),
#     )
#     session.add(row)
#     await session.commit()
#     await session.refresh(row)
#     return row


# async def get_calibration(session: AsyncSession, camera_id: str) -> Calibration | None:
#     return await session.scalar(select(Calibration).where(Calibration.camera_id == camera_id))
