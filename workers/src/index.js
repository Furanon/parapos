export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // API routes
        if (path.startsWith('/api/')) {
            if (path === '/api/log-entry' && request.method === 'POST') {
                const data = await request.json();
                try {
                    const stmt = await env.DB.prepare(
                        'INSERT INTO entries (entry_type, price) VALUES (?, ?)'
                    ).bind(data.entry_type, data.price);
                    await stmt.run();
                    return new Response(JSON.stringify({ success: true }), {
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                } catch (error) {
                    return new Response(JSON.stringify({ error: 'Failed to log entry' }), {
                        status: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            if (path === '/api/summary' && request.method === 'GET') {
                try {
                    const stmt = await env.DB.prepare(
                        'SELECT entry_type, COUNT(*) as count FROM entries GROUP BY entry_type'
                    );
                    const results = await stmt.all();
                    return new Response(JSON.stringify(results), {
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                } catch (error) {
                    return new Response(JSON.stringify({ error: 'Failed to fetch summary' }), {
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

            // Remove leading slash for the KV lookup
            const key = filePath.replace(/^\//, '');
            const asset = await env.__STATIC_CONTENT.get(key);

            if (asset === null) {
                return new Response('Not Found', { status: 404 });
            }

            const contentType = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
            }[filePath.substring(filePath.lastIndexOf('.'))] || 'text/plain';

            return new Response(asset, {
                headers: { 'Content-Type': contentType }
            });
        } catch (e) {
            console.error('Error serving static file:', e);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};
