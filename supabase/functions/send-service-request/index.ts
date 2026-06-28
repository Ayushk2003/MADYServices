declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (
    handler: (request: Request) => Response | Promise<Response>,
  ) => void;
};

type RequestPayload = {
  requestId: string;
  companyEmail: string;
  userEmail: string;
  userName: string;
  serviceTitle: string;
  transcript: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("MAIL_FROM") || "MADY Media <ayushkushwaha182003@gmail.com>";

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured for this Supabase function.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return { sent: true };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await request.json()) as RequestPayload;
    const transcriptHtml = payload.transcript
      .split("\n")
      .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
      .join("");

    await sendEmail({
      to: payload.companyEmail,
      subject: `New MADY service request: ${payload.serviceTitle}`,
      html: `
        <h2>New service request</h2>
        <p>${payload.userName} requested ${payload.serviceTitle}.</p>
        ${transcriptHtml}
      `,
    });

    await sendEmail({
      to: payload.userEmail,
      subject: `Your MADY Media request for ${payload.serviceTitle}`,
      html: `
        <h2>Thank you, ${payload.userName}</h2>
        <p>Your request has reached MADY Media. We will review the details and get back to you with the next step.</p>
        <h3>Your transcript</h3>
        ${transcriptHtml}
      `,
    });

    return new Response(JSON.stringify({ ok: true, requestId: payload.requestId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
