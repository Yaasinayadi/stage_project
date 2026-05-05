from datetime import datetime, timedelta

last_pause = datetime(2026, 5, 3, 10, 0, 0)
resume_time = datetime(2026, 5, 3, 11, 30, 0)

delta = resume_time - last_pause
paused_hours = delta.total_seconds() / 3600.0
print(f"Delta: {delta}")
print(f"Total seconds: {delta.total_seconds()}")
print(f"Paused hours: {paused_hours}")

# Check float_time logic
hours_int = int(paused_hours)
minutes_int = int(round((paused_hours - hours_int) * 60))
print(f"Float time UI: {hours_int:02d}:{minutes_int:02d}")
