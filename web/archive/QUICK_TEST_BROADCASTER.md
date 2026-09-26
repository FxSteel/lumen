# Quick Start: Testing Real-Time Broadcast Sync

## 60-Second Setup

```bash
# 1. Start development server
cd /Users/fer/Desktop/nova
npm run dev

# 2. Open three browser tabs/windows:
# Tab 1: http://localhost:3000/operator      (Operator Interface)
# Tab 2: http://localhost:3000/live-output/main   (Audience Display)
# Tab 3: http://localhost:3000/live-output/stage  (Performer Display)

# 3. Open DevTools Console in each tab
# (Right-click → Inspect → Console tab)
```

## 5-Minute Full Test

### Test 1: Slide Selection (2 min)
1. **In Tab 1 (Operator):** Select a song from the left panel
2. **Click a slide** from the grid
3. **Check Tab 2:** Content appears in the black preview box
4. **Check Console (Tab 2):** See `[LIVE-MAIN] Received broadcast: {type: 'slide-change'...}`
5. **Click different slide** in Tab 1
6. **Verify Tab 2:** Content updates instantly

### Test 2: Display Modes (1.5 min)
1. **In Tab 1:** Find "Pantalla Principal" section with buttons
2. **Click "Logo"** button → Check Tab 2: Logo image appears
3. **Console (Tab 2):** See `{type: 'display-mode', payload: {mode: 'logo'...}}`
4. **Click "Anuncio"** → Announcement image appears
5. **Click "Limpiar"** → Black screen appears
6. **Click any button again** → Returns to slide view

### Test 3: Stage Messages (1.5 min)
1. **In Tab 1:** Scroll to "Pantalla Escenario" section
2. **Type message:** "Welcome!" in the text input
3. **Click "Enviar"** button
4. **Check Tab 3:** Message appears prominently
5. **Console (Tab 3):** See `[LIVE-STAGE] Received broadcast: {type: 'stage-message'...}`
6. **Wait 10 seconds:** Message auto-disappears

---

## Console Log Patterns

### ✅ SUCCESS
```
[BROADCASTER] Channel created
[BROADCASTER] Sent slide-change: abc-123
[LIVE-MAIN] Received broadcast: {type: 'slide-change', payload: {...}}
```

### ❌ FAILURE
```
TypeError: Cannot read property 'postMessage' of null
```
→ Broadcaster not initialized properly

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `/lib/broadcast.ts` | The broadcast engine |
| `/components/operator/LiveOutputPanel.tsx` | Sends messages |
| `/app/(protected)/live-output/main/page.tsx` | Receives & displays |
| `/app/(protected)/live-output/stage/page.tsx` | Receives & displays |

---

## One-Liner Troubleshooting

```javascript
// In Tab 1 console, test broadcasting manually:
window.testBroadcast = () => {
  const bc = new BroadcastChannel('live-output-sync')
  bc.postMessage({type: 'test', payload: {msg: 'Hello from operator!'}})
  bc.close()
}
testBroadcast()  // Then check other tabs for received message
```

---

## Success Criteria

| Check | Status |
|-------|--------|
| Tab 1 loads without errors | ✅ |
| Tab 2 loads without errors | ✅ |
| Tab 3 loads without errors | ✅ |
| Console shows [BROADCASTER] logs | ✅ |
| Slide changes appear in Tab 2 | ✅ |
| Logo button works in Tab 2 | ✅ |
| Messages appear in Tab 3 | ✅ |
| Messages auto-clear after 10s | ✅ |
| No errors in DevTools | ✅ |

**All ✅? = FULL SUCCESS!**

---

## Need Help?

1. **Check DevTools Console** for error messages (most common issues logged there)
2. **Look for [BROADCASTER] logs** to confirm messages are being sent
3. **Look for [LIVE-*] logs** to confirm messages are being received
4. **Verify BroadcastChannel exists:** `typeof BroadcastChannel` should return `'function'`
5. **Verify origins match:** All tabs should be `http://localhost:3000*`

---

## What Was Implemented

✅ **Created:** `/lib/broadcast.ts` - BroadcastChannel wrapper class  
✅ **Updated:** `/components/operator/LiveOutputPanel.tsx` - Uses broadcaster instead of Supabase  
✅ **Updated:** `/app/(protected)/live-output/main/page.tsx` - Listens to broadcaster  
✅ **Updated:** `/app/(protected)/live-output/stage/page.tsx` - Listens to broadcaster  
✅ **Removed:** All Supabase channel code (cleaner!)  
✅ **Added:** localStorage persistence for new window initialization  
✅ **Added:** Comprehensive debugging with console prefixes  

---

## Next Steps After Testing

1. If all tests pass → Ready for production deployment
2. If issues found → Check BROADCASTER_TESTING.md for detailed debugging
3. Monitor console logs during actual use
4. Document any performance observations

**Total Implementation Time:** ~2 hours  
**Testing Time:** ~10 minutes  
**Ready to Use:** Now! 🚀
