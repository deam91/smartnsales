import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_cache():
    # Isolate tests: the cache backs both the dashboard cache and DRF throttling.
    cache.clear()
    yield
