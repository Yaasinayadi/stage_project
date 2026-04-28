const axios = require('axios');

async function fix() {
  try {
    const res = await axios.get('http://localhost:8069/api/tickets');
    const tickets = res.data.data;
    console.log(`Found ${tickets.length} tickets`);
    
    for (const t of tickets) {
      if (!t.category) {
        console.log(`Fixing ticket ${t.id} - ${t.name}...`);
        try {
          await axios.get(`http://localhost:8069/api/ticket/${t.id}/ai-suggest`);
          console.log(`Ticket ${t.id} fixed.`);
        } catch (e) {
          console.error(`Error fixing ticket ${t.id}:`, e.message);
        }
      }
    }
    console.log("Done");
  } catch (e) {
    console.error(e);
  }
}

fix();
