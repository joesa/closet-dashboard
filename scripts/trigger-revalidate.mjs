const secret = process.env.ADMIN_BYPASS_SECRET || '6079bb0e29108031f9ee22855a2bda48b77b34663817abfd86a185c4fd2ed9f4';

async function main() {
  const url = 'http://ceteh-barbershop.localhost:3000/api/revalidate';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-revalidate-secret': secret
      }
    });
    const json = await res.json();
    console.log('Revalidation response:', json);
  } catch (err) {
    console.error('Error triggering revalidation:', err);
  }
}

main().catch(console.error);
