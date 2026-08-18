export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS (pre‑flight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET – read from KV
  if (request.method === 'GET') {
    try {
      console.log('🔍 GET request received');
      
      // Check if KV binding exists
      if (!env.WORK_ORDERS_KV) {
        console.error('❌ WORK_ORDERS_KV is NOT bound!');
        return new Response(
          JSON.stringify({ error: 'KV binding missing' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Try to read from KV
      const data = await env.WORK_ORDERS_KV.get('dashboardData', 'json');
      console.log('✅ Data read from KV:', data ? 'found' : 'empty');

      return new Response(JSON.stringify(data || {}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('❌ GET error:', err.message);
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle POST – write to KV
  if (request.method === 'POST') {
    try {
      console.log('📤 POST request received');

      // Check if KV binding exists
      if (!env.WORK_ORDERS_KV) {
        console.error('❌ WORK_ORDERS_KV is NOT bound!');
        return new Response(
          JSON.stringify({ error: 'KV binding missing' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload = await request.json();
      console.log('📦 Payload keys:', Object.keys(payload));
      console.log('📊 Orders count:', payload.orders?.length || 0);

      // Save to KV
      await env.WORK_ORDERS_KV.put('dashboardData', JSON.stringify(payload));
      console.log('✅ Data saved to KV successfully');

      return new Response(
        JSON.stringify({ status: 'ok', message: 'Data saved' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('❌ POST error:', err.message);
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Method not allowed
  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}