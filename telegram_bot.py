import asyncio
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.filters import Command
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from dotenv import load_dotenv
import os
from aiogram.fsm.storage.memory import MemoryStorage

load_dotenv(override=True)

#shop_bot_tocken
API_TOKEN = os.getenv("API_TOKEN")

# ✅ Новый способ задания настроек
bot = Bot(
    token=API_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)

dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: Message):
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🛍 Открыть магазин",
                    web_app=WebAppInfo(url="https://telegram-app-1up1.onrender.com" \
                   "")
                )
            ]
        ]
    )
    await message.answer("Добро пожаловать в магазин!", reply_markup=kb)

async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
