import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  type: "approved" | "rejected" | "pending";
  fullName: string;
  role?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, type, fullName, role }: EmailRequest = await req.json();

    let subject = "";
    let html = "";

    if (type === "approved") {
      subject = "🎉 Welcome to Krypton Space - Access Approved!";
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1a365d, #2563eb); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .header p { margin: 10px 0 0; opacity: 0.9; }
            .content { padding: 30px; }
            .badge { display: inline-block; background: #1a365d; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
            .cta { display: inline-block; background: linear-gradient(135deg, #1a365d, #2563eb); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
            .footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Krypton Space</h1>
              <p>Where Work Becomes Visible</p>
            </div>
            <div class="content">
              <h2 style="color: #1a365d; margin-top: 0;">Welcome, ${fullName}! 🎉</h2>
              <p>Great news! Your registration request has been <strong>approved</strong>.</p>
              <p>You've been assigned the role:</p>
              <p><span class="badge">${role || "Team Member"}</span></p>
              <p>You can now log in to Krypton Space and start tracking your tasks and collaborating with your team.</p>
              <center>
                <a href="${Deno.env.get("SITE_URL") || "https://lovable.dev"}" class="cta">Login to Krypton Space</a>
              </center>
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                If you have any questions, reach out to your Team Captain.
              </p>
            </div>
            <div class="footer">
              <p>Krypton Space - Internal Team Accountability Platform</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (type === "rejected") {
      subject = "Krypton Space - Registration Update";
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1a365d, #475569); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .header p { margin: 10px 0 0; opacity: 0.9; }
            .content { padding: 30px; }
            .footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Krypton Space</h1>
              <p>Where Work Becomes Visible</p>
            </div>
            <div class="content">
              <h2 style="color: #475569; margin-top: 0;">Hello, ${fullName}</h2>
              <p>Thank you for your interest in joining Krypton Space.</p>
              <p>Unfortunately, your registration request could not be approved at this time.</p>
              <p>If you believe this is an error or have questions, please contact the Team Captain directly.</p>
            </div>
            <div class="footer">
              <p>Krypton Space - Internal Team Accountability Platform</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = "Krypton Space - Registration Request Received";
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1a365d, #2563eb); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .header p { margin: 10px 0 0; opacity: 0.9; }
            .content { padding: 30px; }
            .status { display: inline-block; background: #fef3c7; color: #92400e; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; }
            .footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Krypton Space</h1>
              <p>Where Work Becomes Visible</p>
            </div>
            <div class="content">
              <h2 style="color: #1a365d; margin-top: 0;">Hello, ${fullName}!</h2>
              <p>Thank you for requesting access to Krypton Space.</p>
              <p>Your registration is currently:</p>
              <p><span class="status">⏳ Pending Approval</span></p>
              <p>Our team will review your request shortly. You'll receive another email once your account is approved.</p>
            </div>
            <div class="footer">
              <p>Krypton Space - Internal Team Accountability Platform</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Krypton Space <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
