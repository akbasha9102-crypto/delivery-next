'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { MessageCircle, Navigation, MapPin, AlertCircle, Loader2, CheckCircle2, Play, Bell, Home, Compass } from 'lucide-react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeDriver(driverId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driver_id: driverId, subscription: sub.toJSON() }),
  });
}

type Order = {
  id: string;
  client_name: string;
  client_phone: string;
  delivery_address: string | null;
  client_lat: number | null;
  client_lng: number | null;
  total_amount: number;
  status: string;
  driver_arrived: boolean | null;
  driver_id: string | null;
};

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// Shortest signed angular delta from `from` to `to`, in degrees (-180..180]
function shortestAngleDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

// Bearing from (lat,lng) toward a point ~lookaheadMeters ahead along routeCoords,
// starting from the nearest route point to the driver. Avoids the "cutting corners"
// look of aiming straight at the destination when the road curves.
function bearingFromRoute(
  lat: number,
  lng: number,
  routeCoords: [number, number][],
  lookaheadMeters: number
): number | null {
  if (routeCoords.length < 2) return null;
  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < routeCoords.length; i++) {
    const d = getDistanceMeters(lat, lng, routeCoords[i][0], routeCoords[i][1]);
    if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
  }
  let accumulated = 0;
  let prevLat = lat, prevLng = lng;
  for (let i = nearestIdx; i < routeCoords.length; i++) {
    const [pLat, pLng] = routeCoords[i];
    accumulated += getDistanceMeters(prevLat, prevLng, pLat, pLng);
    prevLat = pLat; prevLng = pLng;
    if (accumulated >= lookaheadMeters || i === routeCoords.length - 1) {
      if (pLat === lat && pLng === lng) return null;
      return calculateBearing(lat, lng, pLat, pLng);
    }
  }
  return null;
}

const OFF_ROUTE_THRESHOLD_M = 60;
const HEADING_DEADBAND_DEG  = 5;   // ignore rotation updates smaller than this
const LOOKAHEAD_METERS      = 30;  // how far ahead on the route to aim the heading
const MIN_SPEED_MPS         = 1;   // below this, GPS speed is considered "stopped"
const MIN_MOVEMENT_M        = 3;   // below this movement between fixes, treat as stationary
const MANUAL_ROTATE_ACTIVATE_DEG      = 6;   // one-finger rotate: cumulative angle needed to enter manual mode
const MANUAL_ROTATE_TICK_DEADBAND_DEG = 1.5; // one-finger rotate: dead zone per touchmove tick once active
const MIN_ROTATE_RADIUS_PX            = 48;  // one-finger rotate: minimum distance from frame center before angle deltas count

// Pure heading candidate calculation, mirrors the priority chain previously inline in
// watchPosition: route bearing → movement bearing → GPS heading → straight-line fallback
// to the customer. Always computed (even while stopped / in manual mode) so the caller
// can decide independently whether to actually apply it.
function computeAutoHeadingCandidate(
  lat: number,
  lng: number,
  gpsHeading: number | null,
  speed: number | null,
  lastPos: { lat: number; lng: number } | null,
  movedSinceLast: number,
  routeCoords: [number, number][],
  clientLat: number | null | undefined,
  clientLng: number | null | undefined
): number | null {
  return (
    bearingFromRoute(lat, lng, routeCoords, LOOKAHEAD_METERS) ??
    (lastPos && movedSinceLast >= MIN_MOVEMENT_M
      ? calculateBearing(lastPos.lat, lastPos.lng, lat, lng)
      : null) ??
    (gpsHeading != null && !isNaN(gpsHeading) && speed != null && speed >= MIN_SPEED_MPS
      ? gpsHeading
      : null) ??
    (routeCoords.length < 2 && clientLat && clientLng
      ? calculateBearing(lat, lng, clientLat, clientLng)
      : null)
  );
}

// Returns true if driver is more than OFF_ROUTE_THRESHOLD_M meters from every sampled point on the route
function isOffRoute(lat: number, lng: number, routeCoords: [number, number][]): boolean {
  if (routeCoords.length < 2) return false;
  const step = Math.max(1, Math.floor(routeCoords.length / 80));
  for (let i = 0; i < routeCoords.length; i += step) {
    if (getDistanceMeters(lat, lng, routeCoords[i][0], routeCoords[i][1]) < OFF_ROUTE_THRESHOLD_M) return false;
  }
  // always check last point too
  const last = routeCoords[routeCoords.length - 1];
  return getDistanceMeters(lat, lng, last[0], last[1]) >= OFF_ROUTE_THRESHOLD_M;
}

// The map itself rotates (heading-up navigation), so the driver arrow stays
// visually fixed pointing "up" — it no longer rotates by GPS heading.
function makeDriverArrow(): string {
  return `<div style="width:46px;height:46px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 10px rgba(37,99,235,0.65))">
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="20,3 33,34 20,27 7,34" fill="#2563eb" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
    </svg>
  </div>`;
}
const DRIVER_ARROW_HTML = makeDriverArrow();

export default function DeliveryPage() {
  const params  = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const router  = useRouter();

  const mapContainerRef    = useRef<HTMLDivElement>(null);
  const frameRef           = useRef<HTMLDivElement>(null);
  const rotatorRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef     = useRef<any>(null);
  const driverMarkerRef    = useRef<any>(null);
  const customerMarkersRef = useRef<any[]>([]);
  const watchIdRef         = useRef<number | null>(null);
  const arrivedSentRef     = useRef(false);
  const lastSaveRef        = useRef<number>(0);
  const routeLineRef       = useRef<any>(null);
  const routeCoordsRef     = useRef<[number, number][]>([]);
  const lastRouteFetchRef  = useRef<number>(0);
  const leafletLinkRef     = useRef<HTMLLinkElement | null>(null);
  const invalidateSizeTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // heading-up navigation state
  const lastPositionRef       = useRef<{ lat: number; lng: number } | null>(null);
  const lastMovementTsRef     = useRef<number>(0);
  const headingAccumulatorRef = useRef<number>(0); // unbounded — can exceed ±360, smooths spins
  // manual one-finger rotation state
  const navModeRef               = useRef<'auto' | 'manual'>('auto');
  const autoHeadingCandidateRef  = useRef<number | null>(null);
  const manualGestureRef         = useRef<{
    id: number;
    centerX: number;
    centerY: number;
    prevAngleDeg: number;
    confirmed: boolean;
    accumulatedDeg: number;
    inDeadZone: boolean;
  } | null>(null);
  const compassIconRef           = useRef<HTMLDivElement>(null);

  const [order,          setOrder]          = useState<Order | null>(null);
  const orderRef = useRef<Order | null>(null);
  const [mapReady,       setMapReady]       = useState(false);
  const [driverOrders,   setDriverOrders]   = useState<Array<{id:string; client_name:string; client_lat:number|null; client_lng:number|null; delivery_address:string|null}>>([]);
  const [loading,        setLoading]        = useState(true);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'tracking' | 'denied'>('idle');
  const [nearCustomer,   setNearCustomer]   = useState(false);
  const [delivering,     setDelivering]     = useState(false);
  const [delivered,      setDelivered]      = useState(false);
  const [started,        setStarted]        = useState(false);
  const [starting,       setStarting]       = useState(false);
  const [notifStatus,    setNotifStatus]    = useState<'idle' | 'granted' | 'denied'>('idle');
  const [navMode,        setNavMode]        = useState<'auto' | 'manual'>('auto'); // display-only — not read on the hot GPS path

  // Central heading-application helper: writes the map rotation + compass-icon rotation
  // in one place so the GPS loop and the manual one-finger gesture don't duplicate it.
  const applyHeading = (angle: number) => {
    headingAccumulatorRef.current = angle;
    if (rotatorRef.current) {
      rotatorRef.current.style.transform = `translate(-50%,-50%) rotate(${-angle}deg)`;
      rotatorRef.current.style.setProperty('--heading-counter', `${angle}deg`);
    }
    if (compassIconRef.current) {
      compassIconRef.current.style.transform = `rotate(${-angle}deg)`;
    }
  };

  useEffect(() => {
    if (!orderId) return;
    supabase
      .from('orders')
      .select('id, client_name, client_phone, delivery_address, client_lat, client_lng, total_amount, status, driver_arrived, driver_id')
      .eq('id', orderId)
      .single()
      .then(({ data }) => {
        setOrder(data);
        if (data?.driver_arrived) { setNearCustomer(true); arrivedSentRef.current = true; }
        if (data?.status === 'completed') setDelivered(true);
        if (data?.status === 'ready' || data?.status === 'completed') setStarted(true);
        setLoading(false);
      });
  }, [orderId]);

  // Keep orderRef in sync without triggering GPS/map effect re-runs
  useEffect(() => { orderRef.current = order; }, [order]);

  // Realtime: only react to status changes, not GPS coordinate saves
  useEffect(() => {
    if (!orderId) return;
    const ch = supabase.channel(`delivery-status-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        ({ new: row }: any) => {
          if (row.id !== orderId) return;
          setOrder(prev => {
            if (!prev || prev.status === row.status) return prev; // same status → same reference → no re-render
            return { ...prev, status: row.status };
          });
          if (row.status === 'ready' || row.status === 'completed') setStarted(true);
          if (row.status === 'completed') setDelivered(true);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    // Notification API is unavailable in iOS Safari (non-PWA) — guard before access
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') setNotifStatus('granted');
    if (Notification.permission === 'denied')  setNotifStatus('denied');
  }, []);

  useEffect(() => {
    if (!order?.driver_id) return;
    if (typeof Notification === 'undefined' || !('PushManager' in window)) return;
    if (Notification.permission === 'granted') {
      setNotifStatus('granted');
      subscribeDriver(order.driver_id);
    }
  }, [order?.driver_id]);

  // Fetch all active orders for this driver (for multi-destination markers)
  useEffect(() => {
    if (!started || !order?.driver_id) return;
    supabase
      .from('orders')
      .select('id, client_name, client_lat, client_lng, delivery_address')
      .eq('driver_id', order.driver_id)
      .in('status', ['pickup', 'ready', 'preparing'])
      .order('created_at', { ascending: true })
      .then(({ data }) => setDriverOrders(data || []));
  }, [order?.driver_id, started]);

  // Draw / refresh numbered customer markers on the map
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    // Remove previous customer markers
    customerMarkersRef.current.forEach(m => m.remove());
    customerMarkersRef.current = [];

    if (!driverOrders.length) return;

    import('leaflet').then(mod => {
      const L = (mod as any).default ?? mod;
      if (!mapInstanceRef.current) return;
      driverOrders.forEach((o, idx) => {
        if (!o.client_lat || !o.client_lng) return;
        const num = idx + 1;
        const isCurrent = o.id === orderId;
        const color = isCurrent ? '#ef4444' : '#f97316';
        // Outer anchor stays unrotated (Leaflet positions it); the inner layer carries
        // a counter-rotation (--heading-counter, kept in sync with the map's rotation
        // on the rotator ancestor) so the pin + number stay visually upright while the
        // map itself spins under heading-up navigation.
        const iconHtml = `<div style="position:relative;width:38px;height:44px">
          <div style="position:relative;width:38px;height:44px;transform:rotate(var(--heading-counter,0deg))">
            <div style="width:38px;height:38px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3)"></div>
            <span style="position:absolute;top:3px;left:0;width:38px;text-align:center;font-weight:900;font-size:15px;color:white;line-height:1.2">${num}</span>
          </div>
        </div>`;
        const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [38, 44], iconAnchor: [19, 44] });
        const marker = L.marker([o.client_lat, o.client_lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(
            `<div dir="rtl" style="font-family:sans-serif;min-width:120px"><b>${o.client_name}</b>${o.delivery_address ? `<br><small style="color:#6b7280">${o.delivery_address}</small>` : ''}</div>`,
            { offset: [0, -20] }
          );
        // Popups don't play well visually on a rotated (CSS-transform) map, and the
        // bottom control panel already surfaces the current customer's name/address —
        // so no auto-open here anymore (previously: `if (isCurrent) marker.openPopup()`).
        customerMarkersRef.current.push(marker);
      });
    });
  }, [mapReady, driverOrders, orderId]);

  useEffect(() => {
    if (!started) return;

    let cancelled = false;
    let mapInitDone = false;

    const doCleanup = () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (invalidateSizeTimeoutRef.current !== null) {
        clearTimeout(invalidateSizeTimeoutRef.current);
        invalidateSizeTimeoutRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        driverMarkerRef.current = null;
        routeLineRef.current = null;
        routeCoordsRef.current = [];
        customerMarkersRef.current = [];
      }
      lastPositionRef.current = null;
      lastMovementTsRef.current = 0;
      headingAccumulatorRef.current = 0;
      if (rotatorRef.current) {
        rotatorRef.current.style.transform = 'translate(-50%,-50%) rotate(0deg)';
        rotatorRef.current.style.setProperty('--heading-counter', '0deg');
      }
      if (compassIconRef.current) {
        compassIconRef.current.style.transform = 'rotate(0deg)';
      }
      navModeRef.current = 'auto';
      setNavMode('auto');
      manualGestureRef.current = null;
      autoHeadingCandidateRef.current = null;
      setMapReady(false);
    };

    if (!('geolocation' in navigator)) {
      setLocationStatus('denied');
      return doCleanup;
    }

    // Initialize map only after first GPS fix — prevents simultaneous GPS dialog + Leaflet load on iOS
    const initMapOnce = () => {
      if (mapInitDone || mapInstanceRef.current || !mapContainerRef.current) return;
      const clientLat = orderRef.current?.client_lat;
      const clientLng = orderRef.current?.client_lng;
      if (!clientLat || !clientLng) return;
      mapInitDone = true;

      if (!leafletLinkRef.current) {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        leafletLinkRef.current = link;
      }

      import('leaflet').then((mod) => {
        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;
        const L = (mod as any).default ?? mod;
        try {
          // dragging: false — the map rotates under heading-up navigation, so manual
          // panning would fight the rotation; "خرائط Google" button covers manual explore.
          const map = L.map(mapContainerRef.current, {
            attributionControl: false, zoomControl: false, dragging: false,
          }).setView([clientLat, clientLng], 15);
          mapInstanceRef.current = map;
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
          setMapReady(true);
          invalidateSizeTimeoutRef.current = setTimeout(() => {
            mapInstanceRef.current?.invalidateSize();
            invalidateSizeTimeoutRef.current = null;
          }, 100);
        } catch (e) {
          console.error('[map] init failed:', e);
        }
      }).catch(() => {});
    };

    setLocationStatus('tracking');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading: gpsHeading, speed } = pos.coords;
        setLocationStatus('tracking');
        const o = orderRef.current;

        // ── Heading-up rotation: figure out which way the map should turn ──
        const lastPos = lastPositionRef.current;
        const movedSinceLast = lastPos
          ? getDistanceMeters(lastPos.lat, lastPos.lng, latitude, longitude)
          : Infinity;
        // Safety valve: near-zero speed + near-zero movement (e.g. stopped at a light)
        // → freeze the last known heading instead of letting GPS jitter spin the map.
        const isStopped = (speed == null || speed < MIN_SPEED_MPS) && movedSinceLast < MIN_MOVEMENT_M;

        // Always compute + store the candidate, regardless of navMode/isStopped, so the
        // compass "recenter" button always has a fresh auto-heading target to snap back to.
        const candidate = computeAutoHeadingCandidate(
          latitude, longitude, gpsHeading, speed, lastPos, movedSinceLast,
          routeCoordsRef.current, o?.client_lat, o?.client_lng
        );
        autoHeadingCandidateRef.current = candidate;

        // Only actually rotate the map while in auto mode — while the driver is manually
        // rotating (or has left it rotated), the GPS loop keeps computing silently but
        // must not fight the manual gesture.
        if (!isStopped && navModeRef.current === 'auto' && candidate != null) {
          const currentNormalized = ((headingAccumulatorRef.current % 360) + 360) % 360;
          const delta = shortestAngleDelta(currentNormalized, candidate);
          if (Math.abs(delta) >= HEADING_DEADBAND_DEG) {
            lastMovementTsRef.current = Date.now();
            applyHeading(headingAccumulatorRef.current + delta);
          }
        }
        lastPositionRef.current = { lat: latitude, lng: longitude };

        const now = Date.now();
        if (now - lastSaveRef.current > 5000) {
          lastSaveRef.current = now;
          supabase.from('orders')
            .update({ driver_lat: latitude, driver_lng: longitude })
            .eq('id', orderId)
            .then(({ error }) => {
              if (error) console.error('[driver-location] فشل حفظ الموقع:', error.message);
            });
        }

        // Initialize map on first GPS fix (iOS: permission dialog is dismissed by now)
        initMapOnce();

        if (mapInstanceRef.current) {
          if (driverMarkerRef.current) {
            driverMarkerRef.current.setLatLng([latitude, longitude]);
            // Follow mode: keep the driver centered under heading-up navigation.
            const zoom = mapInstanceRef.current.getZoom();
            mapInstanceRef.current.setView([latitude, longitude], zoom, { animate: false });
          } else if (o?.client_lat && o?.client_lng) {
            import('leaflet').then((mod) => {
              const L = (mod as any).default ?? mod;
              if (!mapInstanceRef.current || driverMarkerRef.current) return;
              const icon = L.divIcon({
                html: DRIVER_ARROW_HTML,
                className: '', iconSize: [46, 46], iconAnchor: [23, 23],
              });
              driverMarkerRef.current = L.marker([latitude, longitude], { icon })
                .addTo(mapInstanceRef.current)
                .bindPopup('<div dir="rtl">موقعك الحالي</div>');
              mapInstanceRef.current.fitBounds(
                L.latLngBounds([o.client_lat, o.client_lng], [latitude, longitude]),
                { padding: [60, 60] }
              );
            });
          }
        }

        if (o?.client_lat && o?.client_lng && mapInstanceRef.current) {
          const timeSinceLast = Date.now() - lastRouteFetchRef.current;
          const deviated = routeCoordsRef.current.length > 0
            && isOffRoute(latitude, longitude, routeCoordsRef.current);
          // Re-fetch if: first time, or 30s passed, or driver deviated (min 8s cooldown)
          const shouldFetch = !routeLineRef.current
            || timeSinceLast > 30_000
            || (deviated && timeSinceLast > 8_000);

          if (shouldFetch) {
            lastRouteFetchRef.current = Date.now();
            const rLat = latitude, rLng = longitude;
            const cLat = o.client_lat, cLng = o.client_lng;
            fetch(`https://router.project-osrm.org/route/v1/driving/${rLng},${rLat};${cLng},${cLat}?overview=full&geometries=geojson&alternatives=false`)
              .then(r => { if (!r.ok) throw new Error('osrm'); return r.json(); })
              .then(json => {
                const coords: [number, number][] = (json.routes?.[0]?.geometry?.coordinates ?? [])
                  .map(([lng, lat]: [number, number]) => [lat, lng]);
                if (!coords.length || !mapInstanceRef.current) return;
                routeCoordsRef.current = coords;
                import('leaflet').then(mod => {
                  const L = (mod as any).default ?? mod;
                  if (!mapInstanceRef.current) return;
                  if (routeLineRef.current) {
                    routeLineRef.current.setLatLngs(coords);
                  } else {
                    routeLineRef.current = L.polyline(coords, {
                      color: '#2563eb', weight: 5, opacity: 0.85,
                    }).addTo(mapInstanceRef.current);
                    routeLineRef.current.bringToBack();
                  }
                });
              })
              .catch(() => {
                // reset timer so we retry sooner on network failure
                lastRouteFetchRef.current = Date.now() - 22_000;
              });
          }
        }

        if (o?.client_lat && o?.client_lng) {
          const dist = getDistanceMeters(latitude, longitude, o.client_lat, o.client_lng);
          if (dist <= 100 && !arrivedSentRef.current) {
            arrivedSentRef.current = true;
            setNearCustomer(true);
            supabase.from('orders').update({ driver_arrived: true }).eq('id', orderId)
              .then(({ error }) => {
                if (error) { arrivedSentRef.current = false; console.error('[driver-arrived] فشل تحديث الحالة:', error.message); }
              });
          }
        }
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
    );

    return doCleanup;
  }, [orderId, started]);

  // Keep the rotator layer sized to cover the visible frame at any rotation angle,
  // and re-measure the map whenever the frame's on-screen size changes — e.g. the
  // "arrived" banner appearing/disappearing resizes the map area without the window
  // itself resizing, so `window.resize` alone would miss it.
  useEffect(() => {
    if (!started) return;
    const frameEl = frameRef.current;
    if (!frameEl) return;

    const applySize = () => {
      const w = frameEl.clientWidth;
      const h = frameEl.clientHeight;
      if (w > 0 && h > 0 && rotatorRef.current) {
        const diameter = Math.sqrt(w * w + h * h) * 1.05;
        rotatorRef.current.style.width  = `${diameter}px`;
        rotatorRef.current.style.height = `${diameter}px`;
      }
      mapInstanceRef.current?.invalidateSize();
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(frameEl);

    return () => observer.disconnect();
  }, [started]);

  // One-finger manual rotation: overrides the auto heading-up rotation until the driver
  // taps the compass button to snap back to auto. We switched from the previous two-finger
  // rotate gesture to one finger because the two-finger twist felt "غريب" (awkward) to
  // drivers in practice. Since the map has dragging:false (it's always in an automatic
  // "follow" mode — see the map init above), a single finger on the frame wasn't doing
  // anything else already, so repurposing it for rotation gives a natural single-finger
  // feel without colliding with any existing behavior. Note this deliberately diverges
  // from real Google Maps, where one finger pans/drags and two fingers rotate — here a
  // single finger can't pan (dragging is off), so there's no conflict to avoid, and this
  // gesture happily steps aside the moment a second finger lands: Leaflet's own touchZoom
  // pinch-to-zoom handling takes over untouched (see handleTouchStart below).
  useEffect(() => {
    if (!started) return;
    const frameEl = frameRef.current;
    if (!frameEl) return;

    const getTouchAngleFromCenterDeg = (touch: Touch, centerX: number, centerY: number): number =>
      (Math.atan2(touch.clientY - centerY, touch.clientX - centerX) * 180) / Math.PI;

    // Match the tracked touch by identifier, not array index — the browser doesn't
    // guarantee e.touches keeps the same order across events.
    const findTouch = (touches: TouchList, id: number): Touch | null => {
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === id) return touches[i];
      }
      return null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Ignore touches starting on interactive controls inside the frame (e.g. the compass
      // button) — a single-finger tap there must not be mistaken for a rotate gesture.
      if ((e.target as HTMLElement)?.closest('button')) return;

      if (e.touches.length === 1) {
        const t = e.touches[0];
        const rect = frameRef.current?.getBoundingClientRect();
        if (!rect) return;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = Math.hypot(t.clientX - centerX, t.clientY - centerY);
        manualGestureRef.current = {
          id: t.identifier,
          centerX,
          centerY,
          prevAngleDeg: getTouchAngleFromCenterDeg(t, centerX, centerY),
          confirmed: false,
          accumulatedDeg: 0,
          inDeadZone: radius < MIN_ROTATE_RADIUS_PX,
        };
      } else if (e.touches.length >= 2 && manualGestureRef.current) {
        // A second finger landed mid-gesture — hand off to Leaflet's pinch-zoom, don't
        // fight it. Freeze rotation at its current angle instead of resetting to auto.
        manualGestureRef.current = null;
        if (rotatorRef.current) rotatorRef.current.style.transition = 'transform 0.35s linear';
        if (compassIconRef.current) compassIconRef.current.style.transition = 'transform 0.35s linear';
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const gesture = manualGestureRef.current;
      if (!gesture || e.touches.length !== 1) {
        // A second finger appeared (pinch-zoom) or the tracked finger is gone — bail out
        // so Leaflet's own touchZoom handler has sole control.
        if (gesture) manualGestureRef.current = null;
        return;
      }

      const t = findTouch(e.touches, gesture.id);
      if (!t) return;
      e.preventDefault();

      const radius = Math.hypot(t.clientX - gesture.centerX, t.clientY - gesture.centerY);

      if (gesture.inDeadZone) {
        if (radius < MIN_ROTATE_RADIUS_PX) return; // still inside the dead zone — frozen
        // Just exited the dead zone: rebase the angle here so the next tick's delta is
        // meaningful, without applying a jump for this tick.
        gesture.inDeadZone = false;
        gesture.prevAngleDeg = getTouchAngleFromCenterDeg(t, gesture.centerX, gesture.centerY);
        return;
      }

      const newAngleDeg = getTouchAngleFromCenterDeg(t, gesture.centerX, gesture.centerY);
      const delta = shortestAngleDelta(gesture.prevAngleDeg, newAngleDeg);

      if (!gesture.confirmed) {
        gesture.accumulatedDeg += delta;
        if (Math.abs(gesture.accumulatedDeg) >= MANUAL_ROTATE_ACTIVATE_DEG) {
          navModeRef.current = 'manual';
          setNavMode('manual');
          if (rotatorRef.current) rotatorRef.current.style.transition = 'none';
          if (compassIconRef.current) compassIconRef.current.style.transition = 'none';
          gesture.confirmed = true;
          applyHeading(headingAccumulatorRef.current - gesture.accumulatedDeg);
        }
      } else if (Math.abs(delta) >= MANUAL_ROTATE_TICK_DEADBAND_DEG) {
        applyHeading(headingAccumulatorRef.current - delta);
      }

      gesture.prevAngleDeg = newAngleDeg;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        manualGestureRef.current = null;
        if (rotatorRef.current) rotatorRef.current.style.transition = 'transform 0.35s linear';
        if (compassIconRef.current) compassIconRef.current.style.transition = 'transform 0.35s linear';
      }
    };

    frameEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    frameEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    frameEl.addEventListener('touchend', handleTouchEnd, { passive: false });
    frameEl.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      frameEl.removeEventListener('touchstart', handleTouchStart);
      frameEl.removeEventListener('touchmove', handleTouchMove);
      frameEl.removeEventListener('touchend', handleTouchEnd);
      frameEl.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [started]);

  const handleStart = async () => {
    setStarting(true);
    await supabase.from('orders').update({ status: 'ready' }).eq('id', orderId);
    setStarting(false);
    setStarted(true);
    fetch('/api/push/notify-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET! },
      body: JSON.stringify({ order_id: orderId, title: '🛵 طلبك بالطريق', body: 'السائق انطلق إليك الآن', tag: 'order-ready' }),
    }).catch(() => {});
  };

  const completeDelivery = async () => {
    setDelivering(true);
    await supabase.from('orders').update({ status: 'completed', driver_arrived: true }).eq('id', orderId);
    if (order?.driver_id) {
      await supabase.from('drivers').update({ status: 'available' }).eq('id', order.driver_id);
    }
    setDelivered(true);
    setDelivering(false);
    fetch('/api/push/notify-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET! },
      body: JSON.stringify({ order_id: orderId, title: '✅ تم التوصيل', body: 'بالهنا والشفا! نتمنى لك وجبة شهية', tag: 'order-completed' }),
    }).catch(() => {});
  };

  const openGoogleMaps = () => {
    if (!order?.client_lat || !order?.client_lng) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.client_lat},${order.client_lng}&travelmode=driving`, '_blank');
  };

  // Compass button: leave manual mode and snap back to the last computed auto heading
  // (or hold still if none is available yet), taking the shortest angular path.
  const handleRecenter = () => {
    const target = autoHeadingCandidateRef.current ?? headingAccumulatorRef.current;
    const currentNormalized = ((headingAccumulatorRef.current % 360) + 360) % 360;
    const delta = shortestAngleDelta(currentNormalized, target);
    if (rotatorRef.current) rotatorRef.current.style.transition = 'transform 0.35s linear';
    if (compassIconRef.current) compassIconRef.current.style.transition = 'transform 0.35s linear';
    applyHeading(headingAccumulatorRef.current + delta);
    navModeRef.current = 'auto';
    setNavMode('auto');
  };

  // ── تحميل ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── طلب غير موجود ──
  if (!order) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-white font-bold text-xl">الطلب غير موجود</p>
        </div>
      </div>
    );
  }

  // ── تم التوصيل ──
  if (delivered) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative px-6">
        <button
          onClick={() => router.push('/driver/dashboard')}
          className="absolute top-5 right-5 flex items-center gap-2 bg-slate-800 text-slate-300 font-bold text-sm px-4 py-2.5 rounded-2xl border border-slate-700 active:scale-95 transition-all">
          <Home size={16} /> الرئيسية
        </button>
        <div className="text-center">
          <div className="w-32 h-32 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500/30">
            <CheckCircle2 size={70} className="text-green-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">تم التوصيل!</h2>
          <p className="text-slate-400 text-lg">أحسنت، تم إغلاق الطلب بنجاح</p>
          <button
            onClick={() => router.push('/driver/dashboard')}
            className="mt-10 w-full py-4 bg-blue-600 text-white font-black text-lg rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2">
            <Home size={20} /> العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  // ── انتظار جاهزية الطلب (قيد التجهيز) ──
  if (!started && order.status === 'preparing') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-7xl mb-5 animate-pulse">⏳</div>
        <h1 className="text-white font-black text-2xl mb-2">الطلب قيد التجهيز</h1>
        <p className="text-slate-400 text-base mb-8">ستصلك إشعار فور جاهزية الطلب</p>
        <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm border border-slate-700 text-right">
          <p className="text-white font-bold text-lg">{order.client_name}</p>
          {order.delivery_address && <p className="text-slate-400 text-sm mt-1">📍 {order.delivery_address}</p>}
          <p className="text-green-400 font-black text-xl mt-3">{order.total_amount.toLocaleString()} <span className="text-xs text-slate-500 font-normal">د.ع</span></p>
        </div>
      </div>
    );
  }

  // ── شاشة البدء (الطلب جاهز في المطعم) ──
  if (!started) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* هيدر */}
        <div className="px-5 pt-12 pb-6 text-center">
          <div className="text-5xl mb-3">🍔</div>
          <h1 className="text-white font-black text-2xl">الطلب جاهز!</h1>
          <p className="text-slate-400 text-sm mt-1">اذهب للمطعم واستلم الطلب ثم ابدأ التوصيل</p>
        </div>

        {/* بطاقة الطلب */}
        <div className="flex-1 bg-white rounded-t-3xl px-5 pt-6 pb-8 space-y-4">
          {/* اسم العميل والمبلغ */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="bg-green-50 rounded-2xl px-4 py-3 text-center">
              <p className="text-green-600 font-black text-2xl">{order.total_amount.toLocaleString()}</p>
              <p className="text-green-500 text-xs font-medium">دينار عراقي</p>
            </div>
            <div className="text-right">
              <p className="font-black text-gray-900 text-xl">{order.client_name}</p>
              <p className="text-gray-400 text-sm mt-0.5">العميل</p>
            </div>
          </div>

          {/* العنوان */}
          {order.delivery_address && (
            <div className="flex items-start gap-3 py-1">
              <MapPin size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-gray-700 font-medium text-right flex-1">{order.delivery_address}</p>
            </div>
          )}

          {/* واتساب */}
          {order.client_phone && (
            <a href={`https://wa.me/${order.client_phone.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#25D366] text-white font-bold rounded-2xl active:scale-95 transition-all text-base">
              <MessageCircle size={20} /> واتساب العميل
            </a>
          )}

          {/* الإشعارات */}
          {notifStatus === 'idle' && order?.driver_id && (
            <button
              onClick={async () => {
                await subscribeDriver(order.driver_id!);
                setNotifStatus(Notification.permission === 'granted' ? 'granted' : 'denied');
              }}
              className="w-full py-3.5 bg-amber-500 text-white font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 text-base">
              <Bell size={20} /> فعّل إشعارات الطلبات
            </button>
          )}
          {notifStatus === 'granted' && (
            <div className="flex items-center justify-center gap-2 py-2 text-green-600 text-sm font-bold">
              <Bell size={15} className="fill-green-500" /> الإشعارات مفعّلة ✓
            </div>
          )}

          {/* زر البدء */}
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full py-5 bg-blue-600 text-white font-black text-xl rounded-2xl active:scale-95 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-3 disabled:opacity-60 mt-2">
            {starting
              ? <Loader2 size={26} className="animate-spin" />
              : <Play size={26} fill="white" />
            }
            ابدأ التوصيل
          </button>
        </div>
      </div>
    );
  }

  // ── شاشة التوصيل (بعد البدء) ──
  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-900 flex flex-col">

      {/* هيدر */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4">
        <div className="flex items-center gap-2">
          {locationStatus === 'tracking' && (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-300 text-xs font-medium">جاري التتبع</span>
            </>
          )}
          {locationStatus === 'denied' && (
            <>
              <AlertCircle size={14} className="text-amber-400" />
              <span className="text-amber-300 text-xs">الموقع معطّل</span>
            </>
          )}
          {locationStatus === 'idle' && (
            <>
              <Loader2 size={14} className="text-slate-400 animate-spin" />
              <span className="text-slate-400 text-xs">يحدد موقعك...</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏍️</span>
          <h1 className="text-white font-black text-lg">جاري التوصيل</h1>
        </div>
      </div>

      {/* بانر الوصول */}
      {nearCustomer && (
        <div className="mx-4 mb-3 bg-green-500 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">📍</span>
          <div>
            <p className="text-white font-black text-base">وصلت لموقع العميل!</p>
            <p className="text-green-100 text-xs">اضغط "تم التوصيل" بعد تسليم الطلب</p>
          </div>
        </div>
      )}

      {/* الخريطة أو تنبيه لا موقع */}
      <div ref={frameRef} className="relative mx-4 rounded-3xl overflow-hidden flex-1 min-h-0" style={{ minHeight: 300, touchAction: 'none' }}>
        {order.client_lat && order.client_lng ? (
          <>
            {/* Heading-up navigation: the map (rotator) spins via CSS transform inside this
                static, overflow-hidden frame so the driver's direction of travel stays "up". */}
            <div
              ref={rotatorRef}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%) rotate(0deg)',
                transformOrigin: 'center',
                transition: 'transform 0.35s linear',
                willChange: 'transform',
              }}
            >
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>

            {/* Compass button: sibling of the rotator (not inside it) so its own position
                stays fixed on screen while the map rotates under it. Tap to leave manual
                one-finger rotation and snap back to auto heading-up. */}
            <button
              type="button"
              onClick={handleRecenter}
              aria-label="إعادة التوجيه التلقائي للخريطة"
              className={`absolute top-4 left-4 z-[1000] w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-colors ${
                navMode === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/90 text-gray-600 shadow'
              }`}
            >
              <div ref={compassIconRef} style={{ transform: 'rotate(0deg)', transition: 'transform 0.35s linear' }}>
                <Compass size={22} />
              </div>
            </button>
          </>
        ) : (
          <div className="h-full bg-slate-800 flex flex-col items-center justify-center p-6 text-center rounded-3xl border border-slate-700" style={{ minHeight: 220 }}>
            <AlertCircle size={36} className="text-amber-400 mb-3" />
            <p className="text-white font-bold text-lg">العميل لم يشارك موقعه</p>
            <p className="text-slate-400 text-sm mt-1 mb-4">{order.delivery_address || 'لا يوجد عنوان'}</p>
            {order.delivery_address && (
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(order.delivery_address)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm active:scale-95 transition-all">
                <Navigation size={16} /> ابحث في خرائط Google
              </a>
            )}
          </div>
        )}
      </div>

      {/* لوحة التحكم السفلية */}
      <div className="bg-white rounded-t-3xl mt-4 px-5 pt-5 pb-8 space-y-3">

        {/* معلومات العميل */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <span className="bg-green-50 text-green-600 font-black text-lg px-3 py-1.5 rounded-xl">
            {order.total_amount.toLocaleString()} <span className="text-xs font-medium">د.ع</span>
          </span>
          <div className="text-right">
            <p className="font-black text-gray-900 text-lg">{order.client_name}</p>
            {order.delivery_address && (
              <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1 justify-end">
                <MapPin size={10} /> {order.delivery_address}
              </p>
            )}
          </div>
        </div>

        {/* أزرار التنقل والواتساب */}
        <div className="grid grid-cols-2 gap-3">
          {order.client_lat && order.client_lng && (
            <button onClick={openGoogleMaps}
              className="flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:scale-95 transition-all text-sm">
              <Navigation size={18} /> خرائط Google
            </button>
          )}
          {order.client_phone && (
            <a href={`https://wa.me/${order.client_phone.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 py-3.5 bg-[#25D366] text-white font-bold rounded-2xl active:scale-95 transition-all text-sm ${!order.client_lat ? 'col-span-2' : ''}`}>
              <MessageCircle size={18} /> واتساب العميل
            </a>
          )}
          {!order.client_lat && !order.client_phone && <div />}
        </div>

        {/* زر تم التوصيل */}
        <button
          onClick={completeDelivery}
          disabled={delivering}
          className="w-full py-5 bg-green-500 text-white font-black text-xl rounded-2xl active:scale-95 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-60">
          {delivering ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle2 size={24} />}
          تم التوصيل ✓
        </button>
      </div>
    </div>
  );
}
