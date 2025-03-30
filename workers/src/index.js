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
                    // Insert into D1 database
                    const stmt = await env.DB.prepare(
                        'INSERT INTO entries (entry_type, price) VALUES (?, ?)'
                    ).bind(data.entry_type, data.price);
                    const result = await stmt.run();
                    console.log('D1 database entry created:', JSON.stringify(result));
                    
                    // Also log to local file via API endpoint (best effort)
                    try {
                        // Using fetch to send to a local logging API (replace with your actual logging endpoint)
                        const localLogResponse = await fetch('http://localhost:3000/log', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                timestamp: new Date().toISOString(),
                                entry_type: data.entry_type,
                                price: data.price
                            })
                        });
                        
                        if (localLogResponse.ok) {
                            console.log('Successfully saved to local log');
                        } else {
                            console.warn('Failed to save to local log:', await localLogResponse.text());
                        }
                    } catch (localLogError) {
                        // Don't fail the whole request if local logging fails
                        console.warn('Local logging error:', localLogError.message);
                    }
                    
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
                    
                    const stmt = await env.DB.prepare(
                        'SELECT entry_type, COUNT(*) as count, SUM(price) as total_value, AVG(price) as average_price FROM entries GROUP BY entry_type'
                    );
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
