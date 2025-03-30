import sqlite3
import pandas as pd
import random
from datetime import datetime, timedelta

# Connect to the database
conn = sqlite3.connect('../wrangler.db')
cursor = conn.cursor()

# Create the entries table
cursor.execute('''
CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_type TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL
)
''')

# Generate dates from 2024-09-30 through 2025-03-30
start_date = datetime(2024, 9, 30)
end_date = datetime(2025, 3, 30)
dates = pd.date_range(start=start_date, end=end_date)

# Define ticket types and their prices
ticket_types = {
    'Ticket 50': 50.00,
    'Ticket 100': 100.00,
    'Ticket 150': 150.00,
    'Ticket 200': 200.00,
    'Free Ticket': 0.00,
    'Artist Ticket': 0.00
}

# List to store all entries
entries = []

for date in dates:
    # Determine number of entries for this date
    # More entries on weekends
    base_entries = 8 if date.weekday() >= 5 else 4
    daily_entries = random.randint(base_entries, base_entries + 4)
    
    for _ in range(daily_entries):
        # First week of month: higher chance of free/artist tickets
        if date.day <= 7:
            if random.random() < 0.3:  # 30% chance
                entry_type = random.choice(['Free Ticket', 'Artist Ticket'])
            else:
                entry_type = random.choice(['Ticket 50', 'Ticket 100', 'Ticket 150', 'Ticket 200'])
        else:
            # Normal distribution for regular tickets
            weights = [0.4, 0.3, 0.2, 0.1]  # Higher weight for lower-priced tickets
            entry_type = random.choices(
                ['Ticket 50', 'Ticket 100', 'Ticket 150', 'Ticket 200'],
                weights=weights
            )[0]
        
        # Create timestamp within the day
        hour = random.randint(9, 21)  # Between 9 AM and 9 PM
        minute = random.randint(0, 59)
        timestamp = date.replace(hour=hour, minute=minute)
        
        entries.append((
            entry_type,
            ticket_types[entry_type],
            timestamp.strftime('%Y-%m-%d %H:%M:%S')
        ))

# Insert all entries
cursor.executemany(
    'INSERT INTO entries (entry_type, price, created_at) VALUES (?, ?, ?)',
    entries
)

# Commit changes
conn.commit()

# Validate data
print("\nData Validation:")

# Total number of entries
cursor.execute('SELECT COUNT(*) FROM entries')
total_entries = cursor.fetchone()[0]
print(f"Total entries: {total_entries}")

# Entries by type
cursor.execute('''
    SELECT entry_type, COUNT(*) as count 
    FROM entries 
    GROUP BY entry_type 
    ORDER BY count DESC
''')
print("\nEntries by type:")
for entry_type, count in cursor.fetchall():
    print(f"{entry_type}: {count}")

# Weekend vs Weekday distribution
cursor.execute('''
    SELECT 
        CASE 
            WHEN strftime('%w', created_at) IN ('0', '6') THEN 'Weekend'
            ELSE 'Weekday'
        END as day_type,
        COUNT(*) as count
    FROM entries
    GROUP BY day_type
''')
print("\nWeekday vs Weekend distribution:")
for day_type, count in cursor.fetchall():
    print(f"{day_type}: {count}")

# Free/Artist tickets in first week vs rest of month
cursor.execute('''
    SELECT 
        CASE 
            WHEN strftime('%d', created_at) <= '07' THEN 'First Week'
            ELSE 'Rest of Month'
        END as week_type,
        COUNT(*) as count
    FROM entries
    WHERE entry_type IN ('Free Ticket', 'Artist Ticket')
    GROUP BY week_type
''')
print("\nFree/Artist ticket distribution:")
for week_type, count in cursor.fetchall():
    print(f"{week_type}: {count}")

conn.close()

