// Comprehensive test for YouVersion API integration
// Using built-in fetch (Node.js 18+)

// Test configuration
const API_KEY = 'sxaFediGqJjftu5vawObCQQugGMGrAP0zq6uBEqU6tKUTTjL' // Current API key
const BASE_URL = 'https://api.youversion.com/v1'

console.log('='.repeat(80))
console.log('🔬 COMPREHENSIVE YOUVERSION API TEST')
console.log('='.repeat(80))

async function testYouVersionAPI() {
  console.log(`\n📋 Test Configuration:`)
  console.log(`   Base URL: ${BASE_URL}`)
  console.log(`   API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(-4)}`)
  console.log(`   Header: X-YVP-App-Key`)

  // Test 1: Get Bible versions
  console.log(`\n1️⃣  Testing Bible Versions Endpoint`)
  console.log('-'.repeat(50))
  
  try {
    const versionsUrl = `${BASE_URL}/bibles?language_ranges[]=es&language_ranges[]=en&language_ranges[]=*`
    console.log(`   URL: ${versionsUrl}`)
    
    const response = await fetch(versionsUrl, {
      method: 'GET',
      headers: {
        'X-YVP-App-Key': API_KEY,
        'Accept': 'application/json'
      }
    })
    
    console.log(`   Status: ${response.status}`)
    
    if (response.status === 200) {
      const data = await response.json()
      console.log(`   ✅ SUCCESS!`)
      console.log(`   Found ${data.data?.length || 0} Bible versions`)
      
      if (data.data && data.data.length > 0) {
        const first = data.data[0]
        console.log(`   First Bible: "${first.title}" (${first.abbreviation}) - ${first.language_tag}`)
        
        // Check for TPT
        const tptBibles = data.data.filter(bible => 
          bible.abbreviation?.toLowerCase().includes('tpt') ||
          bible.title?.toLowerCase().includes('passion')
        )
        
        console.log(`   🔍 TPT Search Results: ${tptBibles.length} found`)
        tptBibles.forEach(bible => {
          console.log(`      - "${bible.title}" (${bible.abbreviation})`)
        })
        
        // Test 2: Get books for first Bible
        console.log(`\n2️⃣  Testing Books Endpoint`)
        console.log('-'.repeat(50))
        
        const bibleId = first.id
        const booksUrl = `${BASE_URL}/bibles/${bibleId}/books`
        console.log(`   Bible ID: ${bibleId}`)
        console.log(`   URL: ${booksUrl}`)
        
        const booksResponse = await fetch(booksUrl, {
          headers: {
            'X-YVP-App-Key': API_KEY,
            'Accept': 'application/json'
          }
        })
        
        console.log(`   Status: ${booksResponse.status}`)
        
        if (booksResponse.status === 200) {
          const booksData = await booksResponse.json()
          console.log(`   ✅ SUCCESS!`)
          console.log(`   Found ${booksData.data?.length || 0} books`)
          
          if (booksData.data && booksData.data.length > 0) {
            const firstBook = booksData.data[0]
            console.log(`   First Book: "${firstBook.title}" (${firstBook.abbreviation})`)
            
            // Test 3: Get passage
            console.log(`\n3️⃣  Testing Passage Endpoint`)
            console.log('-'.repeat(50))
            
            const passageId = `${firstBook.abbreviation}.1`
            const passageUrl = `${BASE_URL}/bibles/${bibleId}/passages/${passageId}`
            console.log(`   Passage ID: ${passageId}`)
            console.log(`   URL: ${passageUrl}`)
            
            const passageResponse = await fetch(passageUrl, {
              headers: {
                'X-YVP-App-Key': API_KEY,
                'Accept': 'application/json'
              }
            })
            
            console.log(`   Status: ${passageResponse.status}`)
            
            if (passageResponse.status === 200) {
              const passageData = await passageResponse.json()
              console.log(`   ✅ SUCCESS!`)
              console.log(`   Reference: ${passageData.data?.reference}`)
              console.log(`   Content Preview: ${passageData.data?.content?.substring(0, 100)}...`)
            } else {
              const errorText = await passageResponse.text()
              console.log(`   ❌ FAILED: ${errorText}`)
            }
          }
        } else {
          const errorText = await booksResponse.text()
          console.log(`   ❌ FAILED: ${errorText}`)
        }
      }
    } else {
      const errorText = await response.text()
      console.log(`   ❌ FAILED: ${response.status} - ${errorText}`)
      
      if (response.status === 401) {
        console.log(`\n💡 API Key Issue Detected:`)
        console.log(`   The API key appears to be invalid or expired.`)
        console.log(`   1. Visit: https://platform.youversion.com/`)
        console.log(`   2. Sign in with your YouVersion account`)
        console.log(`   3. Generate a new API key`)
        console.log(`   4. Update your .env.local file`)
      }
    }
    
  } catch (error) {
    console.log(`   ❌ NETWORK ERROR: ${error.message}`)
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('🏁 TEST COMPLETE')
  console.log(`${'='.repeat(80)}`)
}

testYouVersionAPI()