"""Unit tests for Haversine distance calculation."""

from app.domains.places.endpoints import _haversine_km


def test_haversine_same_point():
    assert _haversine_km(25.0, 121.0, 25.0, 121.0) == 0.0


def test_haversine_taipei_to_kaohsiung():
    # Taipei to Kaohsiung ≈ 300 km
    dist = _haversine_km(25.033, 121.565, 22.627, 120.301)
    assert 280 < dist < 320


def test_haversine_short_distance():
    # Two points ~1km apart in Taipei
    dist = _haversine_km(25.033, 121.565, 25.034, 121.576)
    assert 0.5 < dist < 2.0
