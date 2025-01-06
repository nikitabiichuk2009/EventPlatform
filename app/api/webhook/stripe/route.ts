import stripe from 'stripe'
import { NextResponse } from 'next/server'
import { createOrder } from '@/lib/actions/order.actions'

export async function POST(request: Request) {
  const body = await request.json()
  console.log('body', body)

  const sig = request.headers.get('stripe-signature') as string
  console.log('sig', sig)
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!
  console.log('endpointSecret', endpointSecret)

  let event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
    console.log('event', event)
  } catch (err) {
    return NextResponse.json({ message: 'Webhook error', error: err })
  }

  // Get the ID and type
  const eventType = event.type
  console.log('eventType', eventType)
  // CREATE
  if (eventType === 'checkout.session.completed') {
    const { id, amount_total, metadata } = event.data.object
    console.log('event.data.object', event.data.object)

    const order = {
      stripeId: id,
      eventId: metadata?.eventId || '',
      buyerId: metadata?.buyerId || '',
      totalAmount: amount_total ? parseFloat(amount_total.toString()) / 100 : 0,
      createdAt: new Date(),
    }
    console.log('orderInWebhook', order)

    const newOrder = await createOrder(order)
    return NextResponse.json({ message: 'OK', order: newOrder })
  }

  return new Response('', { status: 200 })
}