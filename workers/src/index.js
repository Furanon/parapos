import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }

        // API routes
        if (path.startsWith('/api/')) {
            if (path === '/api/log-entry' && request.method === 'POST') {
                const data = await request.json();
                console.log('Received log entry:', JSON.stringify(data));
                
                try {
                    // Get current UTC date for server-side timestamp
                    const now = new Date();
                    const entry_date = now.toISOString().split('T')[0]; // YYYY-MM-DD format
                    const year = now.getUTCFullYear();
                    const month = now.getUTCMonth() + 1; // JavaScript months are 0-based
                    
                    // Calculate week of year (ISO week)
                    const date = new Date(now.getTime());
                    date.setUTCHours(0, 0, 0, 0);
                    date.setUTCDate(date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
                    const week = Math.ceil((((date.getTime() - new Date(date.getUTCFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7);
                    
                    const day = now.getUTCDate();
                    
                    // Insert into D1 database with date components
                    const stmt = await env.DB.prepare(
                        'INSERT INTO entries (entry_type, price, entry_date, entry_timestamp, year, month, week, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                    ).bind(data.entry_type, data.price, entry_date, now.toISOString(), year, month, week, day);
                    const result = await stmt.run();
                    console.log('D1 database entry created:', JSON.stringify(result));
                    
                    return new Response(JSON.stringify({ success: true }), {
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                } catch (error) {
                    console.error('Failed to log entry:', error);
                    return new Response(JSON.stringify({ 
                        error: 'Failed to log entry',
                        message: error.message,
                        stack: error.stack
                    }), {
                        status: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            if (path === '/api/summary' && request.method === 'GET') {
                console.log('Handling summary request');
                try {
                    // First check if the table exists
                    try {
                        const tableCheck = await env.DB.prepare(
                            "SELECT name FROM sqlite_master WHERE type='table' AND name='entries'"
                        ).all();
                        console.log('Table check results:', JSON.stringify(tableCheck));
                        
                        if (!tableCheck.results || tableCheck.results.length === 0) {
                            console.warn('The entries table does not exist in the database');
                            return new Response(JSON.stringify({ 
                                error: 'Table does not exist',
                                message: 'The entries table has not been created yet'
                            }), {
                                status: 404,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*'
                                }
                            });
                        }
                    } catch (tableCheckError) {
                        console.error('Error checking table existence:', tableCheckError);
                    }
                    
                    // Get entry count
                    const countStmt = await env.DB.prepare('SELECT COUNT(*) as count FROM entries');
                    const countResult = await countStmt.first();
                    console.log('Total entries count:', countResult ? countResult.count : 0);
                    
                    // Parse URL parameters for filtering
                    const params = new URL(request.url).searchParams;
                    const filterDate = params.get('date');
                    const filterYear = params.get('year');
                    const filterMonth = params.get('month');
                    const filterWeek = params.get('week');
                    const filterDay = params.get('day');
                    
                    // Build dynamic query with filters
                    let query = 'SELECT entry_date, entry_type, COUNT(*) as count, SUM(price) as total_value, AVG(price) as average_price FROM entries';
                    let whereClause = [];
                    let bindValues = [];
                    
                    if (filterDate) {
                        whereClause.push('entry_date = ?');
                        bindValues.push(filterDate);
                    }
                    if (filterYear) {
                        whereClause.push('year = ?');
                        bindValues.push(parseInt(filterYear));
                    }
                    if (filterMonth) {
                        whereClause.push('month = ?');
                        bindValues.push(parseInt(filterMonth));
                    }
                    if (filterWeek) {
                        whereClause.push('week = ?');
                        bindValues.push(parseInt(filterWeek));
                    }
                    if (filterDay) {
                        whereClause.push('day = ?');
                        bindValues.push(parseInt(filterDay));
                    }
                    
                    if (whereClause.length > 0) {
                        query += ' WHERE ' + whereClause.join(' AND ');
                    }
                    
                    // Default grouping by date and entry type
                    query += ' GROUP BY entry_date, entry_type';
                    
                    // Get daily summary grouped by entry type
                    const stmt = await env.DB.prepare(query);
                    if (bindValues.length > 0) {
                        stmt.bind(...bindValues);
                    }
                    const results = await stmt.all();
                    console.log('Summary results:', JSON.stringify(results));
                    
                    return new Response(JSON.stringify(results), {
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'no-cache'
                        }
                    });
                } catch (error) {
                    console.error('Failed to fetch summary:', error);
                    return new Response(JSON.stringify({ 
                        error: 'Failed to fetch summary',
                        message: error.message,
                        stack: error.stack
                    }), {
                        status: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // API endpoint for date-based summary
            if (path === '/api/daily-summary' && request.method === 'GET') {
                try {
                    const stmt = await env.DB.prepare(
                        'SELECT entry_date, SUM(price) as daily_total, COUNT(*) as entry_count FROM entries GROUP BY entry_date ORDER BY entry_date DESC'
                    );
                    const results = await stmt.all();
                    
                    return new Response(JSON.stringify(results), {
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'no-cache'
                        }
                    });
                } catch (error) {
                    console.error('Failed to fetch daily summary:', error);
                    return new Response(JSON.stringify({ 
                        error: 'Failed to fetch daily summary',
                        message: error.message
                    }), {
                        status: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }
            
            // API endpoint for weekly summary
            if (path === '/api/weekly-summary' && request.method === 'GET') {
                try {
                    const stmt = await env.DB.prepare(
                        'SELECT year, week, SUM(price) as weekly_total, COUNT(*) as entry_count FROM entries GROUP BY year, week ORDER BY year DESC, week DESC'
                    );
                    const results = await stmt.all();
                    
                    return new Response(JSON.stringify(results), {
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'no-cache'
                        }
                    });
                } catch (error) {
                    console.error('Failed to fetch weekly summary:', error);
                    return new Response(JSON.stringify({ 
                        error: 'Failed to fetch weekly summary',
                        message: error.message
                    }), {
                        status: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }
            
            // API endpoint for monthly summary
            if (path === '/api/monthly-summary' && request.method === 'GET') {
                try {
                    const stmt = await env.DB.prepare(
                        'SELECT year, month, SUM(price) as monthly_total, COUNT(*) as entry_count FROM entries GROUP BY year, month ORDER BY year DESC, month DESC'
                    );
                    const results = await stmt.all();
                    
                    return new Response(JSON.stringify(results), {
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'no-cache'
                        }
                    });
                } catch (error) {
                    console.error('Failed to fetch monthly summary:', error);
                    return new Response(JSON.stringify({ 
                        error: 'Failed to fetch monthly summary',
                        message: error.message
                    }), {
                        status: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }
            
            return new Response('Not Found', { status: 404 });
        }

        // Static files
        try {
            let filePath = path;
            if (path === '/' || path === '') {
                filePath = '/index.html';
            }
            
            console.log(`Attempting to serve static file: ${filePath}`);
            
            // Remove leading slash for KV lookup
            const key = filePath.replace(/^\//, '');
            const asset = await env.STATIC_CONTENT.get(key, 'text');
            
            if (asset === null) {
                console.warn(`Static file not found: ${key}`);
                return new Response(`Not Found: ${key}`, { 
                    status: 404,
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                });
            }
            
            console.log(`Successfully retrieved static file: ${key}`);

            const contentType = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css',
                '.js': 'application/javascript',
            }[filePath.substring(filePath.lastIndexOf('.'))] || 'text/plain';

            return new Response(asset, {
                headers: { 
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        } catch (e) {
            console.error('Error serving static file:', e.message);
            console.error('Error stack:', e.stack);
            return new Response(`Internal Server Error: ${e.message}`, { 
                status: 500,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
        }
    }
};
