"""Unit tests for the per-camera incident lifecycle (no camera/model required)."""
from types import SimpleNamespace

from app.detection.incident_state import IncidentState, IncidentStateMachine


def result(*, suspicious: bool, people_count: int = 2, movement: float = 20.0, distance: float = 120.0):
    people = [SimpleNamespace(id=i) for i in range(people_count)]
    return SimpleNamespace(
        suspicious=suspicious,
        people=people,
        people_count=people_count,
        max_movement=movement,
        closest_distance=distance,
    )


def test_incident_starts_once_and_becomes_active():
    machine = IncidentStateMachine("CAM-1", "Main Gate", 0.02)
    incident, alerted = machine.update(result(suspicious=True))
    assert alerted is True
    assert incident.state == IncidentState.ALERT_SENT

    same_incident, alerted_again = machine.update(result(suspicious=True, movement=28.0))
    assert alerted_again is False
    assert same_incident.incident_id == incident.incident_id
    assert same_incident.state == IncidentState.INCIDENT_ACTIVE
    assert same_incident.peak_movement == 28.0


def test_incident_resolves_after_calm_period():
    machine = IncidentStateMachine("CAM-1", "Main Gate", 0.02)
    incident, _ = machine.update(result(suspicious=True))
    machine.update(result(suspicious=False))
    machine._calm_since -= 1.0  # deterministically pass the configured calm window

    resolved, alerted = machine.update(result(suspicious=False))
    assert alerted is False
    assert resolved.incident_id == incident.incident_id
    assert resolved.state == IncidentState.INCIDENT_RESOLVED
    assert resolved.resolved_at is not None


def test_new_episode_gets_a_new_incident_id():
    machine = IncidentStateMachine("CAM-1", "Main Gate", 0.0)
    first, _ = machine.update(result(suspicious=True))
    machine.update(result(suspicious=False))
    machine._calm_since -= 1.0
    machine.update(result(suspicious=False))

    second, alerted = machine.update(result(suspicious=True))
    assert alerted is True
    assert second.incident_id != first.incident_id
