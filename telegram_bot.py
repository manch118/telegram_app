from aiogram import Bot, Dispatcher
from aiogram.types import Message, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.filters import Command
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from dotenv import load_dotenv
from aiogram.fsm.storage.memory import MemoryStorage
import os

load_dotenv(override=True)
API_TOKEN = os.getenv("API_TOKEN")

bot = Bot(
    token=API_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)

dp = Dispatcher(storage=MemoryStorage())

@dp.message(Command("start"))
async def cmd_start(message: Message):
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🛍 Открыть магазин",
                    web_app=WebAppInfo(url="https://4acd-87-241-145-214.ngrok-free.app")
                )
            ]
        ]
    )
    await message.answer("Добро пожаловать в магазин!", reply_markup=kb)

async def start_bot():
    await dp.start_polling(bot)