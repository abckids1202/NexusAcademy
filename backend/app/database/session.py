from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from app.core.config import settings

engine = create_async_engine(settings.database_url, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_session():
    async with AsyncSessionLocal() as session:
        yield session

