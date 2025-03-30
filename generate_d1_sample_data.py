#!/usr/bin/env python3
import random
from datetime import datetime, timedelta
import os

# Configuration
start_date = datetime(2024, 10, 1)
end_date = datetime(2025, 3, 31)
min_entries = 1000
business_hour_start = 9
business_hour_end = 22
output_file = 'd1_sample_data.sql'

# Ticket types with prices and distribution
ticket_types = [
    {"name": "Ticket 50", "price": 50.00, "weight": 0.4},
    {"name": "Ticket 100", "price": 100.00, "weight": 0.3},
    {"name": "Ticket 150", "price": 150.00, "weight": 0.2},
    {"name": "Ticket 200", "price": 200.00, "weight": 0.1},
    {"name": "Free Ticket", "price": 0.00, "weight": 0},  # Weight unused for free tickets
    {"name": "Artist Ticket", "price": 0.00, "weight": 0},  # Weight unused for free tickets
]

# Function to generate random timestamp within business hours
def random_time(date):
    hour = random.randint(business_hour_start, business_hour_end)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return date.replace(hour=hour, minute=minute, second=second)

# Function to get the ISO week number
def get_iso_week(dt):
    return dt.isocalendar()[1]

# Function to get weighted ticket type
def get_paid_ticket_type():
    weights = [ticket["weight"] for ticket in ticket_types[:4]]  # Only paid tickets
    return random.choices(ticket_types[:4], weights=weights, k=1)[0]

# Generate SQL file
with open(output_file, 'w') as f:
    # SQL transaction header
    f.write("BEGIN TRANSACTION;\n\n")
    
    # Create table statement
    f.write("CREATE TABLE IF NOT EXISTS entries (\n")
    f.write("    id INTEGER PRIMARY KEY AUTOINCREMENT,\n")
    f.write("    entry_date DATE NOT NULL,\n")
    f.write("    entry_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n")
    f.write("    entry_type TEXT NOT NULL,\n")
    f.write("    price REAL NOT NULL,\n")
    f.write("    year INTEGER NOT NULL,\n")
    f.write("    month INTEGER NOT NULL,\n")
    f.write("    week INTEGER NOT NULL,\n")
    f.write("    day INTEGER NOT NULL\n")
    f.write(");\n\n")
    
    # Generate entries
    current_date = start_date
    total_entries = 0
    
    while current_date <= end_date:
        is_weekend = current_date.weekday() >= 5  # 5=Saturday, 6=Sunday
        is_start_of_month = current_date.day <= 7
        
        # Determine number of entries for this day
        base_entries = 10 if is_weekend else 4
        daily_entries = random.randint(base_entries, base_entries * 2)
        
        for _ in range(daily_entries):
            # Determine ticket type
            if is_start_of_month and random.random() < 0.3:
                # 30% chance of free/artist tickets at start of month
                ticket = random.choice(ticket_types[4:])  # Free or Artist ticket
            else:
                ticket = get_paid_ticket_type()
            
            timestamp = random_time(current_date)
            
            # Generate SQL INSERT statement
            f.write(f"INSERT INTO entries (entry_date, entry_timestamp, entry_type, price, year, month, week, day) VALUES (")
            f.write(f"'{timestamp.strftime('%Y-%m-%d')}', ")
            f.write(f"'{timestamp.strftime('%Y-%m-%d %H:%M:%S')}', ")
            f.write(f"'{ticket['name']}', {ticket['price']:.2f}, ")
            f.write(f"{timestamp.year}, {timestamp.month}, {get_iso_week(timestamp)}, {timestamp.day}")
            f.write(");\n")
            
            total_entries += 1
        
        current_date += timedelta(days=1)
    
    # SQL transaction footer
    f.write("\nCOMMIT;\n")

print(f"Generated {total_entries} entries in {output_file}")
print(f"SQL file size: {os.path.getsize(output_file) / 1024:.2f} KB")
print(f"Date range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

