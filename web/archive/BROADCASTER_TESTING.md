# Real-Time Broadcast Testing Guide

## Overview
This document provides comprehensive testing steps to verify the BroadcastChannel-based real-time synchronization between the operator interface and live output windows.

## Architecture
- **Broadcaster:** `/lib/broadcast.ts` - LiveOutputBroadcaster class using BroadcastChannel API
- **Operator Panel:** `/components/operator/LiveOutputPanel.tsx` - Sends messages via broadcaster
- **Main Display:** `/app/(protected)/live-output/main/page.tsx` - Pantalla Principal (audience view)
- **Stage Display:** `/app/(protected)/live-output/stage/page.tsx` - Pantalla Escenario (performer view)

## Prerequisites
- Node.js development server running: `npm run dev`
- Multiple browser tabs or windows available
- Browser DevTools console access for debugging

## Test Scenario 1: Slide Change Synchronization

### Steps:
1. Open http://localhost:3000/operator in Tab 1
2. Open http://localhost:3000/live-output/main in Tab 2
3. Open browser DevTools console in both tabs
4. Select a song with multiple slides in Tab 1 operator panel
5. Click different slides in Tab 1
6. **Verify in Tab 2:**
   - Console shows `[LIVE-MAIN] Received broadcast: { type: 'slide-change', ... }`
   - Slide content appears in the preview immediately
   - Multiple clicks show updated content each time

### Expected Console Output:
**Tab 1 (Operator):**
```
[BROADCASTER] Channel created
[BROADCASTER] Sent slide-change: <slide-id>
```

**Tab 2 (Main Display):**
```
[LIVE-MAIN] Received broadcast: {type: 'slide-change', payload: {slideId: '...', content: '...', slideType: '...', label: '...'}}
```

### Pass Criteria:
- ✅ Content updates appear instantly in live output
- ✅ No lag or delay observed
- ✅ Multiple slide changes work correctly
- ✅ Console logs show message flow

---

## Test Scenario 2: Logo/Announcement/Clear Display Modes

### Steps:
1. Keep setup from Test 1
2. In Tab 1 operator panel, locate "Pantalla Principal" buttons (Logo, Anuncio, Limpiar)
3. Upload/configure logo URL in workspace settings if needed
4. Click "Logo" button in operator panel
5. **Verify in Tab 2:**
   - Preview immediately shows configured logo image
   - Console shows `[BROADCASTER] Sent display-mode: logo`
   - Console shows `[LIVE-MAIN] Received broadcast: { type: 'display-mode', payload: { mode: 'logo', ... }}`

6. Click "Anuncio" button
7. **Verify:** Announcement image appears

8. Click "Limpiar" button
9. **Verify:** Black screen appears

### Expected State Changes:
- Logo: Shows logo_url from workspace settings
- Announcement: Shows announcement_url from workspace settings
- Clear: Shows black/empty screen
- Clicking button again: Toggles off, returns to slide view

### Pass Criteria:
- ✅ All three display modes activate correctly
- ✅ Images load and display properly
- ✅ Clear button shows black screen
- ✅ Clicking again deactivates the mode
- ✅ Returns to slide view when toggled off

---

## Test Scenario 3: Stage Window Message Broadcasting

### Steps:
1. Open http://localhost:3000/live-output/stage in Tab 3
2. In Tab 1 operator panel, scroll to "Pantalla Escenario" section
3. Type a message in the message input field (e.g., "Welcome to worship!")
4. Click "Enviar" (Send) button
5. **Verify in Tab 3:**
   - Message appears prominently on stage display
   - Message auto-clears after 10 seconds
   - Console shows `[LIVE-STAGE] Received broadcast: { type: 'stage-message', payload: { message: '...' }}`

### Expected Console Output:
**Tab 1:**
```
[BROADCASTER] Sent stage-message
```

**Tab 3:**
```
[LIVE-STAGE] Received broadcast: {type: 'stage-message', payload: {message: 'Welcome to worship!'}}
Message cleared after 10 seconds
```

### Pass Criteria:
- ✅ Message appears immediately in stage window
- ✅ Message displays in correct position (typically top-right or center)
- ✅ Message auto-clears after 10 seconds
- ✅ Multiple messages can be sent in sequence
- ✅ Console logs show complete message flow

---

## Test Scenario 4: Multiple Window Synchronization

### Steps:
1. Keep all three tabs open from previous tests
2. In Tab 1, select a song and click a slide
3. **Verify both Tab 2 and Tab 3 receive the update:**
   - Tab 2 shows slide content in audience view
   - Tab 3 shows slide content in performer view

4. In Tab 1, click Logo button
5. **Verify:** Tab 2 shows logo, Tab 3 continues showing previous slide content

6. In Tab 1, send a message to stage
7. **Verify:** Tab 3 shows message, Tab 2 is unaffected

### Pass Criteria:
- ✅ Both output windows update independently based on message type
- ✅ Slide changes sync to both windows
- ✅ Display mode changes sync only to main window
- ✅ Stage messages sync only to stage window
- ✅ No cross-contamination between message types

---

## Test Scenario 5: Cross-Browser Tab Synchronization

### Steps:
1. Open another browser window (not tab) with http://localhost:3000/live-output/main
2. Open this in a separate physical display or different position
3. In operator panel (Tab 1), select slides and click them
4. **Verify:** Both main display windows update simultaneously

### Note:
- BroadcastChannel works across tabs AND windows within the same origin
- Each broadcast message reaches ALL listeners on that origin

### Pass Criteria:
- ✅ Both display windows receive identical updates
- ✅ Synchronization is instantaneous across windows
- ✅ No timing differences observed

---

## Test Scenario 6: Initial State Recovery (Page Reload)

### Steps:
1. In Tab 1 operator panel, select a song and click a slide
2. Wait 1-2 seconds
3. Open new Tab 4: http://localhost:3000/live-output/main
4. **Verify in Tab 4:**
   - Slide content appears immediately (from localStorage)
   - Console shows localStorage retrieval
   - Display shows correct slide

### Expected Behavior:
- LiveOutputBroadcaster saves current slide to localStorage
- When output window loads, it reads localStorage first
- Subsequent broadcasts update the display

### Pass Criteria:
- ✅ New output window shows content immediately
- ✅ No "loading" state or blank screen
- ✅ Content is correct (matches selected slide)

---

## Test Scenario 7: Performance Under Rapid Changes

### Steps:
1. Keep Tab 1 and Tab 2 open
2. In operator panel, rapidly click different slides (5-10 clicks in succession)
3. **Verify in Tab 2:**
   - All updates are processed
   - No updates are skipped
   - Final display matches last clicked slide

### Performance Metrics:
- Message latency: Should be <50ms
- Display update: Should be immediate
- CPU usage: Should remain low

### Pass Criteria:
- ✅ All rapid clicks are processed correctly
- ✅ No updates are lost or skipped
- ✅ No UI freezing or lag observed
- ✅ Final state is correct

---

## Debug Console Patterns

### Working Broadcast:
```
[BROADCASTER] Sent slide-change: abc-123-def
[LIVE-MAIN] Received broadcast: {type: 'slide-change', payload: {...}}
```

### Broadcaster Not Initialized:
```
Error: "Cannot read property 'postMessage' of null"
```
**Fix:** Verify BroadcastChannel initialization in broadcaster constructor

### Message Not Received:
```
[BROADCASTER] Sent slide-change: abc-123-def
(no [LIVE-MAIN] log)
```
**Possible Causes:**
- Output window page not fully loaded
- BroadcastChannel listener not attached
- Different origin (e.g., http vs https)

### localStorage Issues:
```
localStorage.setItem is not a function
```
**Likely Cause:** Client-side code running in server-rendering context
**Fix:** Ensure code wrapped in `useEffect` or `'use client'` directive

---

## Debugging Checklist

- [ ] Dev server running without errors (`npm run dev`)
- [ ] No TypeScript compilation errors in console
- [ ] BroadcastChannel API available in browser (Chrome/Edge 54+, Firefox 38+)
- [ ] All three pages load without 401/403 errors
- [ ] localStorage enabled in browser
- [ ] Console showing [BROADCASTER] and [LIVE-*] prefixed logs
- [ ] Broadcaster instance created on component mount
- [ ] Broadcaster closed on component unmount
- [ ] Message payload includes all required fields
- [ ] Display modes toggle correctly

---

## Common Issues & Solutions

### Issue: "BroadcastChannel is not defined"
**Cause:** BroadcastChannel not available in browser/SSR context
**Solution:** 
- Add feature detection: `if (typeof BroadcastChannel !== 'undefined')`
- Ensure code runs in browser only (use `'use client'` in Next.js)

### Issue: Broadcaster sends but receiver doesn't get message
**Cause:** Channel names don't match or listener not attached
**Solution:**
- Verify channel name is `'live-output-sync'` in all files
- Ensure `onMessage()` called before messages sent
- Check that broadcaster instance persists (use useRef)

### Issue: Multiple messages for single action
**Cause:** Multiple broadcaster instances or duplicate listeners
**Solution:**
- Verify broadcaster created only once in useEffect
- Check for duplicate component mounts
- Clean up broadcaster on unmount

### Issue: Messages work in one tab but not another
**Cause:** BroadcastChannel only works same-origin
**Solution:**
- Verify both tabs use `http://localhost:3000` (not different ports/hosts)
- Check browser console for CORS-related errors

---

## Success Verification Checklist

- [ ] Test 1: Slide changes sync to main display ✅
- [ ] Test 2: Logo/Announcement/Clear modes work ✅
- [ ] Test 3: Stage messages appear and auto-clear ✅
- [ ] Test 4: Multiple windows update independently ✅
- [ ] Test 5: Cross-browser window sync works ✅
- [ ] Test 6: New window loads from localStorage ✅
- [ ] Test 7: Rapid changes handled correctly ✅
- [ ] All console logs show expected prefixes ✅
- [ ] No errors in browser console ✅
- [ ] Performance is snappy (<50ms latency) ✅

**Overall Status:** When all items checked ✅, real-time sync is fully operational!

---

## Implementation Files Reference

### Core Implementation:
- **`/lib/broadcast.ts`** (70 lines)
  - LiveOutputBroadcaster class
  - Methods: sendSlideChange, sendDisplayMode, sendMessage, onMessage, close
  - Null-safe channel handling

- **`/components/operator/LiveOutputPanel.tsx`** (692 lines)
  - broadcasterRef with useRef
  - Effect to initialize broadcaster on mount
  - localStorage persistence for current slide
  - Integration with handlePrincipalButton and handleSendMessage

- **`/app/(protected)/live-output/main/page.tsx`** (94 lines)
  - Broadcaster listener for slide-change and display-mode
  - localStorage fallback for initial state
  - Display mode rendering logic

- **`/app/(protected)/live-output/stage/page.tsx`** (82+ lines)
  - Broadcaster listener for slide-change and stage-message
  - Auto-clear message after 10 seconds
  - Time display and layout management

### Related Components:
- **`/lib/store.ts`** - Zustand state with currentSlideId
- **`/components/operator/SongDetail.tsx`** - ID-based slide selection
