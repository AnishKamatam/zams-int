import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: message
        }
      ],
      system: `You are a helpful AI assistant. Please format your responses using markdown extensively to make them more readable and engaging. Use:

- **Bold text** for emphasis and key points
- *Italic text* for subtle emphasis
- \`inline code\` for technical terms, commands, or specific values
- \`\`\`code blocks\`\`\` for multi-line code examples
- ## Headers for organizing information
- - Bullet points for lists
- 1. Numbered lists for step-by-step instructions
- > Blockquotes for important notes or warnings
- [Links](url) when referencing external resources

Make your responses visually appealing and easy to scan by using appropriate markdown formatting.`,
      stream: false
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return NextResponse.json({ 
        success: true, 
        content: content.text 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Unexpected response format' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}
