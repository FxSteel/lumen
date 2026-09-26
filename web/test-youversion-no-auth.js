async function test() {
  const url = 'https://api.youversion.com/v1/bibles?language_ranges[]=es';
  
  console.log('Testing YouVersion API without authentication...');
  console.log('URL:', url);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n🎉 SUCCESS! No auth required!');
      console.log('Response structure:', Object.keys(data));
      console.log('Versions found:', data.data?.length || 0);
      
      if (data.data?.[0]) {
        console.log('First version sample:', {
          id: data.data[0].id,
          title: data.data[0].title,
          abbreviation: data.data[0].abbreviation,
          language_tag: data.data[0].language_tag
        });
      }
      
      // Test if TPT is available
      const hasTPT = data.data?.some(v => 
        v.abbreviation?.toLowerCase().includes('tpt') || 
        v.title?.toLowerCase().includes('passion')
      );
      console.log('TPT found:', hasTPT);
      
    } else {
      const error = await response.text();
      console.log('\n❌ ERROR:', error);
      
      if (response.status === 401) {
        console.log('🔐 Authentication IS required');
      } else if (response.status === 403) {
        console.log('🚫 Forbidden - may need domain whitelisting');  
      } else {
        console.log('❓ Other error - check API endpoint');
      }
    }
  } catch (error) {
    console.log('\n💥 Request failed:', error.message);
  }
}

// Test multiple endpoints
async function testMultiple() {
  const endpoints = [
    'https://api.youversion.com/v1/bibles',
    'https://api.youversion.com/v1/bibles?language_ranges[]=es',
    'https://api.youversion.com/v1/bibles?language_ranges[]=en'
  ];
  
  for (const url of endpoints) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      console.log('Status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ SUCCESS - Count:', data.data?.length || 0);
      } else {
        const error = await response.text();
        console.log('❌ ERROR:', response.status, error.substring(0, 100));
      }
    } catch (error) {
      console.log('💥 Exception:', error.message);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

testMultiple();