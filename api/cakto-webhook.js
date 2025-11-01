import nodemailer from "nodemailer";

/**
 * Função handler da rota /api/cakto-webhook
 * Compatível com Serverless Functions da Vercel (Node runtime)
 */
export default async function handler(req, res) {
  // Libera CORS básico pra não travar requisições externas
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Pré-resposta pra OPTIONS (navegadores às vezes mandam antes do POST real)
  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  // Só pra testar no navegador (GET)
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Webhook ativo e pronto para receber POST da Cakto 🚀"
    });
  }

  // Se não for POST, rejeita
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // --- 1. Lê o corpo enviado pela Cakto ---
    const body = req.body || {};

    const event = body.event;
    const data = body.data || {};
    const customerEmail = data?.customer?.email || "sem-email";
    const productName = data?.product?.name || "produto-desconhecido";

    // Segurança básica: confere segredo
    const providedSecret = body.secret;
    const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.warn("⚠ CAKTO_WEBHOOK_SECRET não configurada na Vercel.");
    }

    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({
        ok: false,
        error: "Segredo inválido",
        detail: "Secret recebido não bate com o configurado no servidor."
      });
    }

    // Só processa compras aprovadas
    if (event !== "purchase_approved") {
      return res.status(200).json({
        ok: true,
        skipped: true,
        message: `Evento ignorado: ${event} (não é purchase_approved)`
      });
    }

    // --- 2. Aqui entraria: criar usuário no Firebase Auth e enviar e-mail de boas-vindas ---
    // No momento vamos só simular o envio de e-mail pra validar deploy.

    // Transporter falso (modo de teste). Depois você troca por um SMTP real tipo Gmail empresarial ou Brevo.
    const transporter = nodemailer.createTransport({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "usuario@example.com",
        pass: "senha-exemplo"
      }
    });

    // Monta e-mail
    const mailOptions = {
      from: '"Painel PrecisionX" <nao-responder@suaproducao.com>',
      to: customerEmail,
      subject: "Acesso liberado ✨",
      text: `Seu acesso ao produto "${productName}" foi liberado.`,
      html: `
        <p>Seu acesso ao produto <b>${productName}</b> foi liberado! </p>
        <p>Use este e-mail (${customerEmail}) pra entrar na área de membros.</p>
      `
    };

    // IMPORTANTE:
    // se esse SMTP for fake (tipo esse exemplo), nodemailer vai falhar.
    // Isso é normal em ambiente sem credencial real.
    // A gente captura erro pra não quebrar o webhook.
    let emailOk = true;
    try {
      await transporter.sendMail(mailOptions);
    } catch (e) {
      console.warn("Falha ao enviar e-mail (ok no ambiente de teste):", e.message);
      emailOk = false;
    }

    // --- 3. Resposta final pra Cakto ---
    return res.status(200).json({
      ok: true,
      message: "Webhook processado com sucesso",
      email: customerEmail,
      productName,
      emailSent: emailOk
    });

  } catch (err) {
    console.error("🔥 ERRO NO WEBHOOK:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro interno no webhook",
      details: err.message || err.toString()
    });
  }
}
