const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

let tokenCache = { accessToken: null, expiraEn: 0 };

async function obtenerAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiraEn) {
    return tokenCache.accessToken;
  }

  const credenciales = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  const respuesta = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credenciales}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!respuesta.ok) {
    throw new Error('No se pudo autenticar con PayPal');
  }

  const datos = await respuesta.json();

  // Se resta 1 minuto de margen para no usar un token a punto de expirar.
  tokenCache = {
    accessToken: datos.access_token,
    expiraEn: Date.now() + (datos.expires_in - 60) * 1000,
  };

  return tokenCache.accessToken;
}

async function crearOrden(montoUSD, returnUrl, cancelUrl) {
  const accessToken = await obtenerAccessToken();

  const respuesta = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: montoUSD.toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Raices Cafe & Vivero',
            return_url: returnUrl,
            cancel_url: cancelUrl,
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
          },
        },
      },
    }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    console.error('Error creando orden de PayPal:', datos);
    throw new Error('No se pudo crear la orden de PayPal');
  }

  const approveUrl = datos.links?.find((link) => link.rel === 'payer-action')?.href
    || datos.links?.find((link) => link.rel === 'approve')?.href;

  if (!approveUrl) {
    throw new Error('PayPal no devolvio un enlace de aprobacion');
  }

  return { orderId: datos.id, approveUrl };
}

async function capturarOrden(orderId) {
  const accessToken = await obtenerAccessToken();

  const respuesta = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    console.error('Error capturando orden de PayPal:', datos);
    return { estado: 'ERROR', mensaje: datos.message || 'No se pudo capturar el pago' };
  }

  const captura = datos.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    estado: datos.status,
    idCaptura: captura?.id || null,
    monto: captura ? parseFloat(captura.amount.value) : null,
    moneda: captura?.amount?.currency_code || null,
  };
}

module.exports = { crearOrden, capturarOrden };
