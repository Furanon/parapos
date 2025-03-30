#!/usr/bin/env python3
import random
import datetime
from datetime import timedelta

# Ticket types and their fixed prices
TICKET_TYPES = {
    "Ticket Artist": 0,
    "Ticket Free": 0,
    "Ticket 50": 50,
    "Ticket 100": 100,
    "Ticket 150": 150,
    "Ticket 200": 200
}

# Distribution weights
WEEKDAY_WEIGHTS = {
    "Ticket Artist": 30,
    "Ticket Free": 35,
    "Ticket 50": 20,
    "Ticket 100": 10,
    "Ticket 150": 4,
    "Ticket 200": 1
}

WEEKEND_WEIGHTS = {
    "Ticket Artist": 15,
    "Ticket Free": 20,
    "Ticket 50": 25,
    "Ticket 100": 20,
    "Ticket 150": 12,
    "Ticket 200": 8
}

# Special dates (holidays, events)
SPECIAL_DATES = [
    (1, 1),    # New Year's Day
    (2, 14),   # Valentine's Day
    (3, 17),   # St. Patrick's Day
    (7, 4),    # Independence Day
    (10, 31),  # Halloween
    (11, 25),  # Thanksgiving
    (12, 24),  # Christmas Eve
    (12, 25),  # Christmas Day
    (12, 31)   # New Year's Eve
]

def generate_entries(start_date, end_date):
    entries = []
    entry_id = 1
    current_date = start_date

    while current_date <= end_date:
        # Determine day type and number of entries
        is_weekend = current_date.weekday() >= 5
        is_special = (current_date.month, current_date.day) in SPECIAL_DATES
        
        if is_special:
            num_entries = random.randint(25, 40)
            weights = WEEKEND_WEIGHTS  # Use weekend distribution for special days
        elif is_weekend:
            num_entries = random.randint(15, 25)
            weights = WEEKEND_WEIGHTS
        else:
            num_entries = random.randint(8, 15)
            weights = WEEKDAY_WEIGHTS

        # Generate entries for the day
        for _ in range(num_entries):
            ticket_type = random.choices(
                list(TICKET_TYPES.keys()),
                weights=list(weights.values()),
                k=1
            )[0]
            
            entries.append({
                'id': entry_id,
                'entry_type': ticket_type,
                'price': TICKET_TYPES[ticket_type]
            })
            
            entry_id += 1
        
        current_date += timedelta(days=1)

    return entries

def main():
    # Generate data for one year
    end_date = datetime.datetime.now().date()
    start_date = end_date - timedelta(days=365)
    
    # Generate entries
    entries = generate_entries(start_date, end_date)
    
    # Write SQL file
    with open('test_data.sql', 'w') as f:
        f.write("-- SQL statements for test data\n")
        f.write("DELETE FROM entries;\n")
        
        for entry in entries:
            f.write(
                f"INSERT INTO entries (id, entry_type, price) "
                f"VALUES ({entry['id']}, '{entry['entry_type']}', {entry['price']});\n"
            )
    
    print(f"Generated {len(entries)} test entries spanning from {start_date} to {end_date}")
    print("SQL file 'test_data.sql' has been created.")

if __name__ == "__main__":
    main()

