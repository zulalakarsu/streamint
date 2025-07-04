from datetime import datetime


def parse_timestamp(timestamp):
    """Parse a timestamp to a datetime object."""
    if isinstance(timestamp, int):
        return datetime.fromtimestamp(timestamp / 1000.0)
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))