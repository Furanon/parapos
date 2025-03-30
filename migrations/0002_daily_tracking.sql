-- Drop existing entries table if it exists
DROP TABLE IF EXISTS entries;

-- Create a new entries table with improved date tracking
CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_date DATE NOT NULL,            -- Date of the entry (YYYY-MM-DD)
    entry_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Precise timestamp when entry was created
    entry_type TEXT NOT NULL,            -- Type of ticket/entry
    price REAL NOT NULL,                 -- Price of the ticket
    year INTEGER NOT NULL,               -- Year component (extracted from entry_date)
    month INTEGER NOT NULL,              -- Month component (1-12)
    week INTEGER NOT NULL,               -- Week of year (1-53)
    day INTEGER NOT NULL                 -- Day of month (1-31)
);

-- Create indexes for efficient querying
CREATE INDEX idx_entries_date ON entries(entry_date);
CREATE INDEX idx_entries_year ON entries(year);
CREATE INDEX idx_entries_month ON entries(month);
CREATE INDEX idx_entries_week ON entries(week);
CREATE INDEX idx_entries_day ON entries(day);
CREATE INDEX idx_entries_type ON entries(entry_type);

