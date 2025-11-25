// AnnouncementsScreen displays broadcasted messages from chama_messages schema
import AnnouncementsScreen from '../../../announcements/AnnouncementsScreen';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Share, Animated, Easing, Dimensions, Platform, StatusBar, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../../../../styles/theme';
import PrimaryButton from '../../../../components/PrimaryButton';
import { useToast } from '../../../../context/ToastContext';
import { useAuth } from '../../../../context/AuthContext';
import { getChama, getInviteCode, getChamaSummary, createChamaNotification, getChamaLoans, getTreasurerOverview, getLoanPoolBalance, getContributionSummaryAnalytics } from '../../../../utils/api';
import { getUnreadChamaMessages as getUnreadChamaMessagesCount } from '../../../../utils/chamaMessages';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { VictoryBar, VictoryChart, VictoryAxis, VictoryGroup, VictoryTheme, VictoryPie, VictoryLabel } from 'victory-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChamaTreasurerDashboard({ route, navigation }){
  const { chama: initialChama, inviteCode: initialCode } = route.params || {};
  const { token, user, logout } = useAuth();
  const { show: toast } = useToast();
  const { colors, spacing, typography } = theme;

  const [chama, setChama] = useState(initialChama || null);
  const [inviteCode, setInviteCode] = useState(initialCode || null);
  const [stats, setStats] = useState({ totalCollected: 0, expectedThisCycle: 0, progress: 0 });
  const [unread, setUnread] = useState(0);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [pendingLoans, setPendingLoans] = useState(0);
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [donutsWidth, setDonutsWidth] = useState(0);
  const [pool, setPool] = useState({ available: 0, outstanding: 0, pending: 0, currency: 'KES' });
  const [loans, setLoans] = useState([]); // for repayments list
  const [themePref, setThemePref] = useState('system'); // 'system' | 'light' | 'dark'
  // Controls for cashflow chart period and bucket
  const [bucket, setBucket] = useState('weekly'); // 'weekly' | 'monthly'
  const [periodLength, setPeriodLength] = useState(6);
  const drawerX = useRef(new Animated.Value(-1)).current; // -1 => hidden, 0 => shown (normalized)
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const drawerWidth = Math.min(Dimensions.get('window').width * 0.8, 320);
  const insets = useSafeAreaInsets();
  const safeTop = (insets?.top && insets.top > 0) ? insets.top : (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const topPadding = Math.max(20, safeTop + 8);
  const shouldReopenDrawerRef = useRef(false);

  const initials = useMemo(()=>{
    const n = chama?.name || '';
    return n.split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase() || 'CH';
  },[chama]);

  useEffect(()=>{
    (async()=>{
      try{
        // Load saved theme preference (for per-user dark mode)
        try {
          const pref = await AsyncStorage.getItem('ui.theme.preference');
          if (pref === 'dark' || pref === 'light' || pref === 'system') setThemePref(pref);
        } catch {}

        let data = chama;
        // Fetch full chama if not present OR if core fields are missing (to avoid zero expected)
        if((!data && initialChama?.id) || (data?.id && (data.contributionAmount == null || !Array.isArray(data.ChamaMembers)))){
          const fresh = await getChama((data?.id || initialChama?.id), token);
          if (fresh && fresh.id) {
            data = fresh;
            setChama(fresh);
          }
        }
        if(data?.id){
          let totalCollected, expectedThisCycle;
          try {
            const { summary, cycle } = await getChamaSummary(data.id, token);
            const rows = Array.isArray(summary) ? summary : [];
            // Use capped totals when available to avoid overage inflating progress
            totalCollected = rows.reduce((a, r)=> a + Number((r.totalPaidCapped ?? r.totalPaid) || 0), 0);
            // Align expected target with TreasurerContributions: active members x amountPerMember
            const membersList = Array.isArray(data?.ChamaMembers) ? data.ChamaMembers : (Array.isArray(data?.chamaMembers) ? data.chamaMembers : (Array.isArray(data?.members) ? data.members : []));
            const activeCount = Array.isArray(membersList) ? membersList.filter(m => m?.status === 'active').length : 0;
            const fallbackCount = rows.length || (Array.isArray(membersList) ? membersList.length : 0);
            const targetCount = activeCount > 0 ? activeCount : fallbackCount;
            // Amount per member prefers chama config; fall back to summary row or cycle info
            const amountPerMember = Number(
              (data && data.contributionAmount != null ? data.contributionAmount : null)
              ?? (rows[0] && rows[0].requiredAmount != null ? rows[0].requiredAmount : null)
              ?? (cycle && cycle.amountPerMember != null ? cycle.amountPerMember : 0)
            );
            expectedThisCycle = amountPerMember * targetCount;
          } catch (e) {
            // Fallback: use analytics summary when payments summary is unavailable (e.g., 503)
            const a = await getContributionSummaryAnalytics(data.id, token).catch(() => null);
            if (a && (typeof a.expected === 'number') && (typeof a.collected === 'number')) {
              expectedThisCycle = Number(a.expected || 0);
              totalCollected = Number(a.collected || 0);
              console.warn('Using analytics summary fallback for donut');
            } else {
              throw e; // rethrow to be handled by outer catch
            }
          }
          const progress = expectedThisCycle > 0 ? (totalCollected/expectedThisCycle)*100 : 0;
          setStats({ totalCollected, expectedThisCycle, progress });

          // Choose sensible defaults based on chama frequency
          const freq = String(data?.frequency || '').toLowerCase();
          const initialBucket = freq.includes('month') ? 'monthly' : 'weekly';
          const initialLength = 6;
          setBucket(initialBucket);
          setPeriodLength(initialLength);

          // Initial treasurer overview fetch (use computed values to avoid async state race)
          try{
            setLoadingOverview(true);
            const ov = await getTreasurerOverview(data.id, { bucket: initialBucket, length: initialLength }, token);
            setOverview(ov);
          } finally {
            setLoadingOverview(false);
          }

          // Initial pool health
          try{
            const pb = await getLoanPoolBalance(data.id, token);
            // Normalize both possible backend response shapes:
            // A) { available, outstanding, pending, currency }
            // B) { availableBalance, activeLoansTotal, pendingLoansTotal, currency? }
            const safe = (pb && typeof pb === 'object') ? pb : {};
            const normalized = (typeof safe.available === 'number' || typeof safe.outstanding === 'number' || typeof safe.pending === 'number')
              ? {
                  available: Number(safe.available || 0),
                  outstanding: Number(safe.outstanding || 0),
                  pending: Number(safe.pending || 0),
                  currency: safe.currency || 'KES'
                }
              : {
                  available: Number(safe.availableBalance || 0),
                  // Use principal totals as an approximation for outstanding/pending when detailed breakdown is returned
                  outstanding: Number(safe.activeLoansTotal || 0),
                  pending: Number(safe.pendingLoansTotal || 0),
                  currency: safe.currency || 'KES'
                };
            setPool(normalized);
          } catch {}

          // Initial loans list (for repayments)
          try {
            const resp = await getChamaLoans(data.id, token);
            const list = resp.loans || resp || [];
            setLoans(Array.isArray(list) ? list : []);
          } catch {}
        }
      }catch(e){
        const status = e?.response?.status;
        const url = e?.config?.url;
        console.warn('Dashboard init load failed', { status, url });
      }
    })();
  },[]);

  // Instant refresh when bucket or periodLength changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!chama?.id) return;
      try {
        setLoadingOverview(true);
        const ov = await getTreasurerOverview(chama.id, { bucket, length: periodLength }, token);
        if (!cancelled) setOverview(ov);
      } catch(e){
        const status = e?.response?.status;
        const url = e?.config?.url;
        console.warn('Treasurer overview fetch failed', { status, url });
      } finally {
        if (!cancelled) setLoadingOverview(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bucket, periodLength, chama?.id, token]);

  // Poll unread announcements for badge (group messages)
  useEffect(()=>{
    let stop = false;
    async function tick(){
      try{
        if(!token || !chama?.id){ if(!stop) setUnread(0); return; }
        const res = await getUnreadChamaMessagesCount(chama.id, token);
        if(!stop) setUnread(Number(res?.unread || 0));
      }catch{/* ignore */}
    }
    tick();
    const id = setInterval(tick, 10000);
    return ()=>{ stop = true; clearInterval(id); };
  }, [token]);


  // Auto-refresh stats when focused and periodically
  useFocusEffect(
    React.useCallback(() => {
      let stopped = false;
      const fetchStats = async () => {
        if (stopped) return;
        try{
          const data = chama || (initialChama?.id ? await getChama(initialChama.id, token) : null);
          if(data?.id){
            if(!chama) setChama(data);
            let totalCollected, expectedThisCycle;
            try{
              const { summary, cycle } = await getChamaSummary(data.id, token);
              const rows = Array.isArray(summary) ? summary : [];
              totalCollected = rows.reduce((a, r)=> a + Number((r.totalPaidCapped ?? r.totalPaid) || 0), 0);
              const membersList = Array.isArray(data?.ChamaMembers) ? data.ChamaMembers : (Array.isArray(data?.chamaMembers) ? data.chamaMembers : (Array.isArray(data?.members) ? data.members : []));
              const activeCount = Array.isArray(membersList) ? membersList.filter(m => m?.status === 'active').length : 0;
              const fallbackCount = rows.length || (Array.isArray(membersList) ? membersList.length : 0);
              const targetCount = activeCount > 0 ? activeCount : fallbackCount;
              const amountPerMember = Number(
                (data && data.contributionAmount != null ? data.contributionAmount : null)
                ?? (rows[0] && rows[0].requiredAmount != null ? rows[0].requiredAmount : null)
                ?? (cycle && cycle.amountPerMember != null ? cycle.amountPerMember : 0)
              );
              expectedThisCycle = amountPerMember * targetCount;
            } catch(e) {
              const a = await getContributionSummaryAnalytics(data.id, token).catch(() => null);
              if (a && (typeof a.expected === 'number') && (typeof a.collected === 'number')) {
                expectedThisCycle = Number(a.expected || 0);
                totalCollected = Number(a.collected || 0);
                console.warn('Using analytics summary fallback for donut');
              } else {
                throw e;
              }
            }
            const progress = expectedThisCycle > 0 ? (totalCollected/expectedThisCycle)*100 : 0;
            setStats({ totalCollected, expectedThisCycle, progress });
            // Refresh overview (respect current bucket/periodLength)
            try{
              const ov = await getTreasurerOverview(data.id, { bucket, length: periodLength }, token);
              setOverview(ov);
            }catch{}
            // Refresh pool health
            try{
              const pb = await getLoanPoolBalance(data.id, token);
              const safe = (pb && typeof pb === 'object') ? pb : {};
              const normalized = (typeof safe.available === 'number' || typeof safe.outstanding === 'number' || typeof safe.pending === 'number')
                ? {
                    available: Number(safe.available || 0),
                    outstanding: Number(safe.outstanding || 0),
                    pending: Number(safe.pending || 0),
                    currency: safe.currency || 'KES'
                  }
                : {
                    available: Number(safe.availableBalance || 0),
                    outstanding: Number(safe.activeLoansTotal || 0),
                    pending: Number(safe.pendingLoansTotal || 0),
                    currency: safe.currency || 'KES'
                  };
              setPool(normalized);
            }catch{}
            // Fetch loans (for repayments list) and count needing verification for badge
            try {
              const resp = await getChamaLoans(data.id, token);
              const list = resp.loans || resp || [];
              const count = list.filter(l => l.status === 'approved' || l.status === 'pending_treasurer').length;
              setPendingLoans(count);
              setLoans(Array.isArray(list) ? list : []);
            } catch {}
          }
        }catch(e){
          const status = e?.response?.status;
          const url = e?.config?.url;
          console.warn('Dashboard periodic stats failed', { status, url });
        }
      };
      fetchStats();
      const id = setInterval(fetchStats, 7000);
      return () => { stopped = true; clearInterval(id); };
    }, [initialChama?.id, token, chama?.id, bucket, periodLength])
  );

  const openDrawer = () => {
    setDrawerVisible(true);
    Animated.parallel([
      Animated.timing(drawerX, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = (onDone) => {
    Animated.parallel([
      Animated.timing(drawerX, { toValue: -1, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => { 
      if(finished) setDrawerVisible(false);
      if(typeof onDone === 'function') onDone();
    });
  };

  const goFromMenu = (routeName, params) => {
    shouldReopenDrawerRef.current = true;
    closeDrawer(() => navigation?.navigate(routeName, params));
  };

  const handleInvite = async ()=>{
    try{
      const res = await getInviteCode(chama.id, token);
      setInviteCode(res.inviteCode);
      toast('Invite code generated');
    }catch(e){ toast('Failed to get invite code'); }
  };

  const copyCode = async ()=>{
    if(!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    toast('Invite code copied!');
  };

  const shareCode = async ()=>{
    if(!inviteCode) return;
    try{
      await Share.share({ message: `Join our chama "${chama.name}": code ${inviteCode}` });
    }catch(e){ /* ignore */ }
  };

  if(!chama){
    return <View style={[styles.screen,{backgroundColor: colors.bg}]}><Text>Loading...</Text></View>
  }

  const hasMembers = Array.isArray(chama.ChamaMembers) && chama.ChamaMembers.length > 1;
  const startDate = chama.startDate ? new Date(chama.startDate) : null;
  const today = new Date();
  const status = startDate ? (startDate > today ? 'Upcoming' : 'Active') : 'Active';
  const statusColor = status === 'Active' ? theme.colors.success : theme.colors.warning;

  const totalCollected = stats.totalCollected;
  const expectedThisCycle = stats.expectedThisCycle;
  const collectionProgress = stats.progress;

  // Format percent so very small contributions don't appear as 0%
  const formatPct = (p) => {
    const v = Number(p);
    if (!isFinite(v) || v <= 0) return '0';
    if (v < 1) return v.toFixed(2);
    if (v < 10) return v.toFixed(1);
    return String(Math.round(v));
  };

  // Build chart data
  const points = overview?.points || [];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const xLabels = points.map(p => {
    const d = new Date(p.t);
    if (bucket === 'monthly') {
      return months[d.getMonth()]; // MMM
    }
    return `${d.getMonth()+1}/${d.getDate()}`; // MM/DD
  });
  const contributionsData = points.map((p, i)=> ({ x: i+1, y: Number(p.contributions || 0) }));
  const disbursementsData = points.map((p, i)=> ({ x: i+1, y: Number(p.disbursements || 0) }));
  const collectionRatePct = Math.round(((overview?.kpis?.collectionRate || 0) * 100));
  const currency = (pool && pool.currency) ? pool.currency : 'KES';
  const axisXLabel = bucket === 'monthly' ? 'Month (MMM)' : 'Week (MM/DD)';

  // Donut datasets (pool only). Cycle visualization will use simple text to avoid flaky chart when API is down.
  const poolAvail = Number(pool.available || 0);
  const poolOut = Number(pool.outstanding || 0);
  const poolPend = Number(pool.pending || 0);
  const poolTotal = Math.max(0, poolAvail + poolOut + poolPend);
  const availPctTotal = poolTotal > 0 ? (poolAvail / poolTotal) * 100 : 0;
  const outPctTotal = poolTotal > 0 ? (poolOut / poolTotal) * 100 : 0;
  const pendPctTotal = poolTotal > 0 ? (poolPend / poolTotal) * 100 : 0;
  const poolData = poolTotal > 0 ? [
    { x: 'Avail', y: poolAvail, color: theme.colors.success },
    { x: 'Lent', y: poolOut, color: theme.colors.danger },
    { x: 'Pending', y: poolPend, color: theme.colors.warning },
  ] : [];

  const collected = Number(totalCollected || 0);
  const expected = Number(expectedThisCycle || 0);
  const remaining = Math.max(0, expected - collected);
  const cycleData = expected > 0 ? [
    { x: 'Collected', y: collected, color: theme.colors.success },
    { x: 'Remaining', y: remaining, color: theme.colors.danger },
  ] : [];

  return (
  <LinearGradient colors={[ '#ACB0FF', theme.palette.skyBlue[600]]} start={{x:0,y:0}} end={{x:0,y:1}} style={[styles.screen, {paddingTop: topPadding}]}>  
      {/* Top bar with hamburger */}
      <View style={styles.topBar}>
        <Pressable onPress={openDrawer} style={({pressed})=>[styles.iconRound, pressed && {opacity:0.7}]}> 
          <Ionicons name="menu" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={[typography.h3, {flex:1, textAlign:'center'}]}>Treasurer Dashboard</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          {/* <Pressable
            onPress={async ()=>{
              const next = themePref === 'dark' ? 'light' : 'dark';
              setThemePref(next);
              try { await AsyncStorage.setItem('ui.theme.preference', next); } catch {}
              toast(`Theme set to ${next}`);
            }}
            accessibilityLabel="Toggle dark mode"
            style={({pressed})=>[styles.iconRound, pressed && {opacity:0.7}]}
          >
            <Ionicons name={themePref === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={theme.colors.text} />
          </Pressable> */}
          <Pressable onPress={()=> navigation?.navigate('Announcements', { chamaId: chama?.id })} style={({pressed})=>[styles.iconRound, pressed && {opacity:0.7}, {position:'relative'}]}>
            <Ionicons name="notifications-outline" size={20} color={theme.colors.text} />
            {!!unread && unread > 0 && (
              <View style={{position:'absolute', right:8, top:6, width:8, height:8, borderRadius:999, backgroundColor: theme.colors.danger}} />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={{flexDirection:'row', alignItems:'center', gap:12}}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={{flex:1}}>
            <View style={{flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap'}}>
              <Text style={typography.h2}>{chama.name}</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>TREASURER</Text></View>
            </View>
            <View style={{flexDirection:'row', alignItems:'center', marginTop:6, gap:8}}>
              <View style={[styles.statusDot, {backgroundColor: statusColor}]} />
              <Text style={{color: theme.colors.textMuted, fontWeight:'600'}}>{status}</Text>
              <View style={[styles.chip, {marginLeft:8}]}><Text style={styles.chipText}>{String(chama.contributionAmount)} · {chama.frequency}</Text></View>
            </View>
            {!!user?.name && (
              <Text style={{marginTop:8, color: theme.colors.text}}>Welcome back, <Text style={{fontWeight:'700'}}>{String(user.name).split(' ')[0]}</Text>.</Text>
            )}
          </View>
        </View>
      </View>

      {/* Donuts row: Pool Health and Cycle Completion */}
      <View style={styles.financialCard} onLayout={(e)=> setDonutsWidth(e?.nativeEvent?.layout?.width || 0)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderText}>Financial Overview</Text>
        </View>
        <View style={{ flexDirection:'column', gap: 12, padding: 16 }}>
          {/* Pool Health */}
          <View style={[styles.donutCard, { width: '100%' }]}>
            <Text style={styles.donutTitle}>Loan Contribution Pool</Text>
            {poolTotal <= 0 ? (
              <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>No pool data yet</Text>
            ) : (
              <View style={styles.donutInnerRow}>
                <VictoryPie
                  width={140}
                  height={140}
                  innerRadius={60}
                  padAngle={1}
                  data={poolData}
                  x="x"
                  y="y"
                  colorScale={poolData.map(d=> d.color)}
                  labels={()=> null}
                />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={styles.centerLabelTop}>Available</Text>
                  <Text style={styles.centerLabelValue}>KSh {poolAvail.toLocaleString()}</Text>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
                    <Text style={styles.legendLabel}>Available ({formatPct(availPctTotal)}%)</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: theme.colors.danger }]} />
                    <Text style={styles.legendLabel}>Lent out ({formatPct(outPctTotal)}%)</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: theme.colors.warning }]} />
                    <Text style={styles.legendLabel}>Pending approval ({formatPct(pendPctTotal)}%)</Text>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.centerLabelTop}>Total pool</Text>
                    <Text style={[styles.centerLabelValue, { fontSize: 16 }]}>KSh {poolTotal.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Cycle Completion (Victory donut, mirrors Current Cycle card) */}
          <View style={[styles.donutCard, { width: '100%' }]}> 
            <Text style={styles.donutTitle}>Table Banking Pool</Text>
            {(expected <= 0) ? (
              <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>No target set</Text>
            ) : (
              <View style={styles.donutInnerRow}>
                <VictoryPie
                  width={140}
                  height={140}
                  innerRadius={60}
                  padAngle={1}
                  data={cycleData}
                  x="x"
                  y="y"
                  colorScale={cycleData.map(d=> d.color)}
                  labels={()=> null}
                />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.centerLabelTop}>Collected</Text>
                  <Text style={styles.centerLabelValue}>KSh {collected.toLocaleString()} of KSh {expected.toLocaleString()}</Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                    {formatPct(expected > 0 ? (collected/expected)*100 : 0)}% complete
                  </Text>
                  <View style={[styles.legendRow, { marginTop: 6 }]}>
                    <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
                    <Text style={styles.legendLabel}>Collected</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: theme.colors.danger }]} />
                    <Text style={styles.legendLabel}>Remaining (KSh {remaining.toLocaleString()})</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>

  {/* Cashflow (6 weeks): Contributions vs Disbursements */}
      <View style={styles.financialCard} onLayout={(e)=> setChartWidth(e?.nativeEvent?.layout?.width || 0)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderText}>Cashflow (last {periodLength} {bucket === 'monthly' ? 'months' : 'weeks'})</Text>
          <View style={[styles.chip, {paddingVertical:4, backgroundColor: 'rgba(255,255,255,0.2)'}]}>
            <Text style={[styles.chipText, {fontSize:12, color: '#fff'}]}>Collection rate: {isNaN(collectionRatePct) ? '-' : `${collectionRatePct}%`}</Text>
          </View>
        </View>
        {/* Controls: bucket and period length */}
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, alignItems:'center', marginBottom:8, marginTop: 8, paddingHorizontal: 16 }}>
          <View style={{ flexDirection:'row', gap:6 }}>
            {['weekly','monthly'].map(b => (
              <Pressable key={b} onPress={()=> setBucket(b)} style={[styles.chip, b===bucket && { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.chipText, b===bucket && { color: 'white' }]}>{b === 'weekly' ? 'Weekly' : 'Monthly'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ width: 8 }} />
          <View style={{ flexDirection:'row', gap:6 }}>
            {[4,6,8,12].map(len => (
              <Pressable key={len} onPress={()=> setPeriodLength(len)} style={[styles.chip, len===periodLength && { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.chipText, len===periodLength && { color: 'white' }]}>{len}</Text>
              </Pressable>
            ))}
          </View>
          {/*
          <Pressable
            onPress={async ()=>{
              if (!chama?.id) return;
              try {
                setLoadingOverview(true);
                const ov = await getTreasurerOverview(chama.id, { bucket, length: periodLength }, token);
                setOverview(ov);
              } finally {
                setLoadingOverview(false);
              }
            }}
            style={[styles.chip, { marginLeft: 'auto', paddingVertical: 6 }]}>
           {/* <Text style={[styles.chipText, { fontWeight:'700' }]}>Apply</Text> 
          </Pressable> */}
        </View>
        {/* Inline legend to avoid chart overflow */}
        <View style={[styles.legendRow, { paddingHorizontal: 16 }]}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
          <Text style={styles.legendLabel}>Contributions</Text>
          <View style={{ width: 12 }} />
          <View style={[styles.legendDot, { backgroundColor: theme.colors.warning }]} />
          <Text style={styles.legendLabel}>Disbursements</Text>
        </View>
        {loadingOverview ? (
          <Text style={{ color: theme.colors.textMuted, paddingHorizontal: 16 }}>Loading chart…</Text>
        ) : chartWidth <= 0 ? (
          <Text style={{ color: theme.colors.textMuted, paddingHorizontal: 16 }}>Preparing chart…</Text>
        ) : (
          <View style={[styles.chartWrapper, { paddingHorizontal: 16 }]}>
            <VictoryChart
              width={Math.max(0, chartWidth - 24)}
              height={230}
              padding={{ top: 8, bottom: 44, left: 64, right: 12 }}
              theme={VictoryTheme.material}
              domainPadding={{ x: 20, y: 10 }}
            >
              <VictoryAxis
                label={axisXLabel}
                tickValues={points.map((_, i)=> i+1)}
                tickFormat={(t)=> xLabels[t-1] || ''}
                style={{ 
                  tickLabels: { fontSize: 10, fill: theme.colors.textMuted },
                  axisLabel: { padding: 30, fontSize: 11, fill: theme.colors.textMuted, fontWeight: '600' }
                }}
              />
              <VictoryAxis
                dependentAxis
                label={`Amount (${currency})`}
                axisLabelComponent={<VictoryLabel angle={-90} />}
                tickFormat={(v)=> v >= 1000 ? `${Math.round(v/1000)}k` : `${v}`}
                style={{ 
                  grid: { stroke: theme.colors.primarySurface }, 
                  tickLabels: { fontSize: 10, fill: theme.colors.textMuted },
                  axisLabel: { padding: 46, fontSize: 11, fill: theme.colors.textMuted, fontWeight: '600' }
                }}
              />
              <VictoryGroup offset={14}>
                <VictoryBar data={contributionsData} style={{ data: { fill: theme.colors.success, borderRadius: 4 } }} cornerRadius={2} />
                <VictoryBar data={disbursementsData} style={{ data: { fill: theme.colors.warning, borderRadius: 4 } }} cornerRadius={2} />
              </VictoryGroup>
            </VictoryChart>
          </View>
        )}
      </View>

      
      {/* Quick Actions for Treasurer (no manual Record Payment) 
      <View style={styles.quickActions}>
        <Text style={{fontWeight:'700', fontSize:16, marginBottom:12}}>Quick Actions</Text>
        <View style={{flexDirection:'row', gap:12}}>
          <View style={{flex:1}}>
            <PrimaryButton 
              title="View Contributions" 
              onPress={()=> navigation?.navigate('TreasurerContributions', { chamaId: chama.id })} 
              variant="secondary"
              size="sm"
            />
          </View>
          <View style={{flex:1}}>
            <PrimaryButton 
              title="View Members" 
              onPress={()=> navigation?.navigate('ViewMembers', { chamaId: chama.id })} 
              variant="secondary"
              size="sm"
            />
          </View>
        </View>
        <View style={{marginTop:12}}>
          <PrimaryButton 
            title="Contribute via M-Pesa"
            onPress={()=> navigation?.navigate('Payment', { chamaId: chama.id, defaultAmount: String(chama.contributionAmount || '') })}
          />
        </View>
      </View>

      */}

      {/* Invite Section (Simplified for Treasurer) */}
      {inviteCode && (
        <View style={styles.inviteBox}>
          <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
            <Text style={{fontWeight:'600', fontSize:14}}>Invite Code</Text>
            <View style={{flexDirection:'row', gap:8}}>
              <Pressable style={styles.iconBtn} onPress={copyCode}><Ionicons name="copy-outline" size={16} color="#0f172a" /></Pressable>
              <Pressable style={styles.iconBtn} onPress={shareCode}><Ionicons name="share-social-outline" size={16} color="#0f172a" /></Pressable>
            </View>
          </View>
          <Text style={[styles.codeText, {fontSize:18}]}>{inviteCode}</Text>
        </View>
      )}

  </ScrollView>
  {/* Overlay and Drawer */}
      {drawerVisible && (
        <Animated.View pointerEvents={drawerVisible ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, {backgroundColor:'rgba(16,73,17,0.5)', opacity: overlayOpacity}]}>
          <Pressable style={{flex:1}} onPress={closeDrawer} />
        </Animated.View>
      )}
  <Animated.View style={[styles.drawer, { width: drawerWidth, paddingTop: 16 + safeTop, transform: [{ translateX: drawerX.interpolate({ inputRange:[-1,0], outputRange:[-drawerWidth, 0] }) }] }]}>
        <View style={styles.drawerHeader}>
          <View style={[styles.avatar, {width:36, height:36}]}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={{marginLeft:10, flex:1}}>
            <Text style={{fontWeight:'700'}} numberOfLines={1}>{chama.name}</Text>
            <Text style={{color: theme.colors.textMuted, fontSize:12}}>Treasurer</Text>
          </View>
          <Pressable onPress={closeDrawer} style={({pressed})=>[styles.iconRound, pressed && {opacity:0.7}]}>
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        <ScrollView 
          style={{ flex: 1 }} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
  {/* Treasurer-specific menu items (Record payment removed) */}
        <Text style={styles.sectionLabel}>Chama Management</Text>
        <DrawerItem icon="bar-chart-outline" label="Chama contributions" onPress={()=> goFromMenu('TreasurerContributions', { chamaId: chama.id })} />
    <DrawerItem icon="people-outline" label="Chama members" onPress={()=> goFromMenu('ViewMembers', { chamaId: chama.id })} />
  { /* Member payments removed to avoid duplication; use View contributions */ }
  {/* Removed redundant entries: Generate report, Analytics */}

<Text style={styles.sectionLabel}>My Account</Text>
        <DrawerItem icon="person-outline" label="My contributions" onPress={()=> goFromMenu('TreasurerPersonalContributions', { chamaId: chama.id })} />

  <Text style={styles.sectionLabel}>Financial Services</Text>
  <DrawerItem icon="card-outline" label="Loans Dashboard" onPress={()=> goFromMenu('Loans', { chamaId: chama.id })} />
  <DrawerItem icon="checkmark-done-outline" label="Verify loans" badge={pendingLoans} onPress={()=> goFromMenu('TreasurerVerifyLoans', { chamaId: chama.id })} />

    <Text style={styles.sectionLabel}>Communication</Text>
  {/*
    'Announcements' navigates to the Notifications route, which loads AnnouncementsScreen (polls chama messages).
    Unread badge is based on unread group messages.
  */}
  <DrawerItem icon="notifications-outline" label="Announcements" onPress={()=> navigation?.navigate('Announcements', { chamaId: chama?.id })} unread={unread} />
  {/*
    'Message group' navigates to the GroupMessage route for broadcasting to chama_messages schema.
  */}
  <DrawerItem icon="chatbubble-ellipses-outline" label="Message group" onPress={()=> goFromMenu('GroupMessage', { chamaId: chama.id })} />
  {/* Ledger and Append entry removed per requirements */}

        
  <Text style={styles.sectionLabel}>Support</Text>
  <DrawerItem icon="help-circle-outline" label="Help & support" onPress={()=> goFromMenu('HelpSupport', { chamaId: chama.id })} />
        <DrawerItem icon="log-out-outline" label="Logout" danger onPress={()=>{ closeDrawer(); logout(); }} />
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
}

function DrawerItem({ icon, label, onPress, danger, unread, badge }){
  return (
    <Pressable onPress={onPress} style={({pressed})=>[styles.drawerItem, pressed && {backgroundColor: theme.colors.primarySurface}] }>
      <View style={{position:'relative'}}>
        <Ionicons name={icon} size={20} color={danger ? theme.colors.danger : theme.colors.text} />
        {!!unread && unread > 0 && (
          <View style={{position:'absolute', right:-2, top:-2, width:8, height:8, borderRadius:999, backgroundColor: theme.colors.danger}} />
        )}
      </View>
      <Text style={[styles.drawerItemText, danger && {color: theme.colors.danger}]}>{label}</Text>
      {!!badge && badge > 0 && (
        <View style={{ marginLeft: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>{badge}</Text>
        </View>
      )}
      {!danger && <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} style={{marginLeft:'auto'}} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen:{ flex:1, padding:20 },
  topBar:{ flexDirection:'row', position:'fixed', alignItems:'center', justifyContent:'space-between', marginBottom:0, borderRadius: 12, borderColor: theme.colors.border, borderBottomWidth: 1, paddingBottom: 4 },
  iconRound:{ width:36, height:36, borderRadius:999, alignItems:'center', justifyContent:'center', backgroundColor: 'transparent' },
  avatar:{ width:44, height:44, borderRadius:999, backgroundColor: theme.colors.primarySurface, alignItems:'center', justifyContent:'center' },
  avatarText:{ color: theme.colors.primary, fontWeight:'700' },
  badge:{ backgroundColor: theme.colors.primarySurface, paddingHorizontal:8, paddingVertical:4, borderRadius:999 },
  badgeText:{ color: theme.colors.primary, fontSize:10, fontWeight:'700' },
  summaryCard:{ backgroundColor: theme.colors.card, padding:16, borderRadius:12, marginTop:6 },
  chip:{ backgroundColor: theme.colors.primarySurface, paddingHorizontal:10, paddingVertical:6, borderRadius:999 },
  chipText:{ color: theme.colors.text, fontSize:12, fontWeight:'600' },
  financialCard:{ backgroundColor: theme.colors.card, borderRadius:12, marginTop:16, overflow: 'hidden' },
  cardHeader:{ backgroundColor: theme.colors.primaryActive, padding:16, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  cardHeaderText:{ fontWeight:'700', fontSize:16, color: '#fff' },
  progressCircle:{ width:60, height:60, borderRadius:30, backgroundColor: theme.colors.primarySurface, alignItems:'center', justifyContent:'center', borderWidth:3, borderColor: theme.colors.success },
  quickActions:{ backgroundColor: theme.colors.card, padding:16, borderRadius:12, marginTop:16 },
  
  inviteBox:{ backgroundColor: theme.colors.card, padding:16, borderRadius:12, marginTop:16 },
  codeText:{ fontSize:18, letterSpacing:1, fontWeight:'700', marginTop:8 },
  iconBtn:{ backgroundColor: theme.colors.primarySurface, padding:6, borderRadius:8 },
  statusDot:{ width:8, height:8, borderRadius:999 },
  drawer:{ position:'absolute', left:0, top:0, bottom:0, backgroundColor: theme.colors.card, paddingTop:16, paddingHorizontal:12, elevation:8, shadowColor:'#000', shadowOpacity:0.15, shadowRadius:8, shadowOffset:{width:0,height:4} },
  drawerHeader:{ flexDirection:'row', alignItems:'center', marginBottom:8 },
  sectionLabel:{ marginTop:12, marginBottom:6, color: theme.colors.textMuted, fontSize:12, fontWeight:'700' },
  drawerItem:{ flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12, paddingHorizontal:8, borderRadius:8 },
  drawerItemText:{ color: theme.colors.text, fontWeight:'600' },
  rowWrap:{ flexDirection:'row', flexWrap:'wrap' },
  donutCard:{ backgroundColor: theme.colors.card, borderRadius:8 },
  donutTitle:{ fontWeight:'700', marginBottom:6 },
  donutInnerRow:{ flexDirection:'row', alignItems:'center' },
  centerLabelTop:{ color: theme.colors.textMuted, fontSize:12 },
  centerLabelValue:{ fontWeight:'800', fontSize:18, marginBottom:6 },
  legendRow:{ flexDirection:'row', alignItems:'center', marginTop:6 },
  legendDot:{ width:10, height:10, borderRadius:999, marginRight:6 },
  legendLabel:{ fontSize:12, color: theme.colors.text },
  chartWrapper:{ alignItems:'center' },
  metricRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:6 },
  metricLabel:{ fontSize:12, color: theme.colors.textMuted, fontWeight:'600' },
  metricLabelValue:{ fontSize:12, color: theme.colors.text, fontWeight:'700' },
  metricBar:{ height:6, borderRadius:999, backgroundColor: theme.colors.primarySurface, overflow:'hidden', marginTop:4 },
  metricBarFill:{ height:'100%', borderRadius:999 }
});