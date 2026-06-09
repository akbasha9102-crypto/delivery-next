'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Phone, Navigation, MapPin, AlertCircle, Loader2 } from 'lucide-react';

type Order = {
  id: string;
  client_name: string;
  client_phone: string;
  delivery_address: string | null;
  client_lat: number | null;
  client_lng: number | null;
  total_amount: number;
  status: string;
};

export default function DeliveryPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'tracking' | 'denied'>('idle');

  useEffect(() => {
    if (!orderId) return;
    supabase
      .from('orders')
      .select('id, client_name, client_phone, delivery_address, client_lat, client_lng, total_amount, status')
      .eq('id', orderId)
      .single()
      .then(({ data }) => {
        setOrder(data);
        setLoading(false);
      });
  }, [orderId]);

  useEffect(() => {
    if (!order?.client_lat || !order?.client_lng) return;
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current).setView(
        [order.client_lat!, order.client_lng!], 15
      );
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const customerIcon = L.divIcon({
        html: `<div style="width:36px;height:36px;background:#ef4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35)"></div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      L.marker([order.client_lat!, order.client_lng!], { icon: customerIcon })
        .addTo(map)
        .bindPopup(
          `<div dir="rtl" style="font-family:sans-serif;min-width:120px"><b>${order.client_name}</b>${order.delivery_address ? `<br><small style="color:#6b7280">${order.delivery_address}</small>` : ''}</div>`,
          { offset: [0, -18] }
        )
        .openPopup();

      if (!('geolocation' in navigator)) {
        setLocationStatus('denied');
        return;
      }

      setLocationStatus('tracking');
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocationStatus('tracking');

          const driverIcon = L.divIcon({
            html: `<div style="width:40px;height:40px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:20px">🏍️</div>`,
            className: '',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });

          if (driverMarkerRef.current) {
            driverMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            driverMarkerRef.current = L.marker([latitude, longitude], { icon: driverIcon })
              .addTo(map)
              .bindPopup('<div dir="rtl">موقعك الحالي</div>');

            map.fitBounds(
              L.latLngBounds(
                [order.client_lat!, order.client_lng!],
                [latitude, longitude]
              ),
              { padding: [50, 50] }
            );
          }
        },
        () => setLocationStatus('denied'),
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
      );
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        driverMarkerRef.current = null;
      }
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, [order]);

  const openGoogleMaps = () => {
    if (!order?.client_lat || !order?.client_lng) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${order.client_lat},${order.client_lng}&travelmode=driving`,
      '_blank'
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-gray-600 dark:text-slate-300 font-bold text-lg">الطلب غير موجود</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-6">
      <header className="bg-blue-600 text-white px-4 py-4 sticky top-0 z-[999]">
        <h1 className="text-xl font-bold text-center">🏍️ توصيل طلب</h1>
      </header>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {/* Order summary card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-green-600 font-bold text-lg">
              {order.total_amount.toLocaleString()} <span className="text-xs font-normal text-gray-400">د.ع</span>
            </span>
            <div className="text-right">
              <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">{order.client_name}</p>
              {order.delivery_address && (
                <p className="text-gray-500 dark:text-slate-400 text-sm flex items-center gap-1 justify-end mt-0.5">
                  <span>{order.delivery_address}</span>
                  <MapPin size={12} className="flex-shrink-0" />
                </p>
              )}
            </div>
          </div>

          {order.client_phone && (
            <a
              href={`tel:${order.client_phone}`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 text-white font-bold rounded-xl active:scale-95 transition-all"
            >
              <Phone size={18} /> اتصال بالعميل
            </a>
          )}
        </div>

        {/* Map section */}
        {order.client_lat && order.client_lng ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm">
            {locationStatus === 'tracking' && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">يتم تتبع موقعك لحظة بلحظة</span>
              </div>
            )}
            {locationStatus === 'denied' && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900">
                <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                <span className="text-amber-700 dark:text-amber-300 text-sm">اسمح بالموقع لتتبع مسارك</span>
              </div>
            )}
            {locationStatus === 'idle' && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-600">
                <Loader2 size={14} className="text-gray-400 animate-spin" />
                <span className="text-gray-500 dark:text-slate-400 text-sm">جاري تحديد موقعك...</span>
              </div>
            )}
            <div ref={mapContainerRef} style={{ height: 380 }} />
            <button
              onClick={openGoogleMaps}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Navigation size={18} /> فتح في Google Maps
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 text-center">
            <AlertCircle size={32} className="text-amber-500 mx-auto mb-2" />
            <p className="text-amber-800 dark:text-amber-300 font-bold">الزبون لم يشارك موقعه</p>
            <p className="text-amber-600 dark:text-amber-400 text-sm mt-1">
              {order.delivery_address || 'لا يوجد عنوان محدد'}
            </p>
            {order.delivery_address && (
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(order.delivery_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm active:scale-95 transition-all"
              >
                <Navigation size={16} /> ابحث عن العنوان في Google Maps
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
