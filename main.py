from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List
import models, schemas, database
from fastapi.middleware.cors import CORSMiddleware
import os
import aiohttp
from dotenv import load_dotenv
import datetime
from pydantic import BaseModel
from sqlalchemy.orm import joinedload
from aiogram.types import Update as WebhookUpdate
import stripe
from fastapi.responses import JSONResponse
import traceback
import asyncio

load_dotenv(override=True)  # Принудительно перезаписывать переменные
bot_token = os.getenv("BOT_TOKEN")
admin_chat_id = os.getenv("ADMIN_CHAT_ID")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
load_dotenv(override=True)
stripe_secret_key = os.getenv("STRIPE_SECRET_KEY")
print(f"Loaded STRIPE_SECRET_KEY: {stripe_secret_key}")
if not stripe_secret_key:
    raise ValueError("STRIPE_SECRET_KEY is not set in .env")

stripe.api_key = stripe_secret_key


# Добавьте этот код в начало вашего main.py, перед созданием FastAPI приложения
from sqlalchemy import text

def update_db_structure(db: Session = database.SessionLocal()):
    try:
        # Проверяем есть ли столбец payment_date
        result = db.execute(text("PRAGMA table_info(orders)"))
        columns = [row[1] for row in result]
        
        if 'payment_date' not in columns:
            print("Добавляем столбец payment_date в таблицу orders")
            db.execute(text("ALTER TABLE orders ADD COLUMN payment_date TIMESTAMP"))
            db.commit()
            print("Структура базы успешно обновлена")
        else:
            print("Столбец payment_date уже существует")
            
    except Exception as e:
        print(f"Ошибка обновления структуры базы: {str(e)}")
        db.rollback()
    finally:
        db.close()

# Вызываем функцию обновления перед созданием приложения
update_db_structure()


app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://web.telegram.org", "https://5370-87-241-180-199.ngrok-free.app", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=database.engine)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("templates/index.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/products/", response_model=List[schemas.Product])
async def get_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

@app.post("/products/")
async def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.delete("/products/{product_id}")
async def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(db_product)
    db.commit()
    return {"message": "Product deleted successfully"}

#stripe
@app.post("/orders/{order_id}/confirm")
async def confirm_order(order_id: int, body: dict):
    try:
        payment_intent_id = body.get("payment_intent_id")
        # Проверяем PaymentIntent в Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        if payment_intent.status == "succeeded":
            # Здесь обнови статус заказа в базе данных, например, на "Оплачен"
            # Пример: update_order_status(order_id, "Оплачен")
            return {"status": "success", "message": f"Заказ #{order_id} оплачен"}
        else:
            raise HTTPException(status_code=400, detail="Оплата не подтверждена")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cart/", response_model=schemas.CartItem)
async def add_to_cart(cart_item: schemas.CartItemCreate, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == cart_item.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    existing_item = db.query(models.CartItem).filter(
        models.CartItem.user_id == cart_item.user_id,
        models.CartItem.product_id == cart_item.product_id
    ).first()
    
    if existing_item:
        existing_item.quantity += cart_item.quantity
        db.commit()
        db.refresh(existing_item)
        return existing_item
    
    db_cart_item = models.CartItem(**cart_item.model_dump())
    db.add(db_cart_item)
    db.commit()
    db.refresh(db_cart_item)
    return db_cart_item

@app.get("/cart/{user_id}", response_model=List[schemas.CartItem])
async def get_cart(user_id: str, db: Session = Depends(get_db)):
    return db.query(models.CartItem).filter(models.CartItem.user_id == user_id).all()

@app.put("/cart/{cart_item_id}", response_model=schemas.CartItem)
async def update_cart_item(cart_item_id: int, update_data: schemas.CartItemUpdate, db: Session = Depends(get_db)):
    db_cart_item = db.query(models.CartItem).filter(models.CartItem.id == cart_item_id).first()
    if not db_cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    
    if update_data.quantity <= 0:
        db.delete(db_cart_item)
    else:
        db_cart_item.quantity = update_data.quantity
        db.commit()
        db.refresh(db_cart_item)
    
    db.commit()
    return db_cart_item

@app.delete("/cart/{user_id}")
async def clear_cart(user_id: str, db: Session = Depends(get_db)):
    deleted_count = db.query(models.CartItem).filter(models.CartItem.user_id == user_id).delete()
    db.commit()
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cart is already empty")
    return {"message": "Cart cleared successfully"}

@app.delete("/cart/{cart_item_id}")
async def delete_cart_item(cart_item_id: int, db: Session = Depends(get_db)):
    db_cart_item = db.query(models.CartItem).filter(models.CartItem.id == cart_item_id).first()
    if not db_cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    
    db.delete(db_cart_item)
    db.commit()
    return {"message": "Cart item deleted successfully"}

@app.post("/checkout/{user_id}")
async def checkout(user_id: str, order_data: schemas.OrderCreate, db: Session = Depends(get_db)):
    try:
        print(f"Получен заказ от user_id: {user_id}, данные: {order_data.model_dump()}")

        # Проверки данных
        if order_data.user_id != user_id:
            raise HTTPException(status_code=400, detail="Несоответствие User ID")

        if not order_data.phone or not order_data.address:
            raise HTTPException(status_code=400, detail="Телефон и адрес обязательны")

        if not order_data.items:
            raise HTTPException(status_code=400, detail="Корзина пуста")

        # Проверяем товары
        for item in order_data.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Товар {item.product_id} не найден")

        # Создаём заказ
        db_order = models.Order(
            user_id=user_id,
            total=order_data.total,
            phone=order_data.phone,
            address=order_data.address,
            delivery_method=order_data.delivery_method,
            payment_method=order_data.payment_method,
            status="Ожидает оплаты" if order_data.payment_method == "Карта" else "В обработке",
            order_date=datetime.datetime.now()
        )
        db.add(db_order)
        db.commit()
        db.refresh(db_order)

        # Добавляем товары в заказ
        for item in order_data.items:
            db_item = models.OrderItem(
                order_id=db_order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=item.price
            )
            db.add(db_item)
        db.commit()

        # Всегда отправляем уведомление админу, независимо от способа оплаты
        print(f"Заказ #{db_order.id} успешно сохранён, отправляем уведомление")
        await send_order_notification(db_order, db)

        # Очищаем корзину только для наличных
        if order_data.payment_method != "Карта":
            db.query(models.CartItem).filter(models.CartItem.user_id == user_id).delete()
            db.commit()

        return {
            "status": "success",
            "order_id": db_order.id,
            "total": order_data.total,
            "message": "Заказ успешно оформлен",
            "payment_required": order_data.payment_method == "Карта"
        }

    except HTTPException as he:
        print(f"HTTP ошибка: {he.detail}")
        raise he
    except Exception as e:
        db.rollback()
        print(f"Ошибка сервера: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

async def send_order_notification(order: models.Order, db: Session):
    try:
        items = db.query(models.OrderItem).filter(models.OrderItem.order_id == order.id).all()
        items_text = "\n".join([f"• {item.product.name} - {item.quantity} × {item.price} ₽" for item in items])
        message = (
            "<b>🛒 Новый заказ!</b>\n\n"
            f"<b>📅 Дата:</b> {order.order_date.strftime('%d.%m.%Y %H:%M')}\n"
            f"<b>🆔 Номер:</b> #{order.id}\n"
            f"<b>👤 Клиент:</b> {order.user_id}\n"
            f"<b>📞 Телефон:</b> <code>{order.phone}</code>\n"
            f"<b>🏠 Адрес:</b> {order.address}\n"
            f"<b>🚚 Доставка:</b> {order.delivery_method}\n"
            f"<b>💳 Оплата:</b> {order.payment_method}\n\n"
            f"<b>Состав заказа:</b>\n{items_text}\n\n"
            f"<b>💰 Итого:</b> {order.total} ₽\n"
            f"<b>📌 Статус:</b> {order.status}"
        )
        print(f"Отправляем уведомление: {message}")
        telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with aiohttp.ClientSession() as session:
            async with session.post(telegram_url, json={
                "chat_id": admin_chat_id,
                "text": message,
                "parse_mode": "HTML"
            }) as response:
                response_data = await response.json()
                print(f"Ответ Telegram API: {response_data}")
                if response.status != 200:
                    raise Exception(f"Failed to send notification: {response_data}")
        print("Уведомление успешно отправлено")
    except Exception as e:
        print(f"Ошибка отправки уведомления: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка отправки уведомления: {str(e)}")
    
    
    
@app.get("/products/filter/", response_model=List[schemas.Product])
async def filter_products(category: str = None, min_price: float = 0, max_price: float = float("inf"), query: str = None, db: Session = Depends(get_db)):
    db_query = db.query(models.Product)
    if category and category != "all":
        db_query = db_query.filter(models.Product.category == category)
    if query:
        db_query = db_query.filter(models.Product.name.ilike(f"%{query}%"))
    db_query = db_query.filter(models.Product.price >= min_price, models.Product.price <= max_price)
    return db_query.all()

@app.get("/check-admin/{user_id}")
async def check_admin(user_id: str, db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.user_id == user_id).first()
    return {"is_admin": admin.is_admin if admin else False}

@app.post("/add-admin/{user_id}")
async def add_admin(user_id: str, db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.user_id == user_id).first()
    if admin:
        if admin.is_admin:
            raise HTTPException(status_code=400, detail="Пользователь уже является администратором")
        admin.is_admin = True
    else:
        admin = models.Admin(user_id=user_id, is_admin=True)
        db.add(admin)
    db.commit()
    db.refresh(admin)
    return {"message": "Администратор добавлен", "is_admin": admin.is_admin}

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    upload_dir = "static/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return {"file_path": f"/static/uploads/{file.filename}"}


@app.get("/orders/{user_id}", response_model=List[schemas.Order])
async def get_orders(user_id: str, db: Session = Depends(get_db)):
    print(f"Запрос заказов для user_id: {user_id}")
    orders = db.query(models.Order).options(joinedload(models.Order.items)).filter(models.Order.user_id == user_id).all()
    if not orders:
        print("Заказы не найдены")
        return []
    for order in orders:
        for item in order.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            item.product_name = product.name if product else "Неизвестный товар"
        print(f"Заказ #{order.id} содержит {len(order.items)} элементов: {[item.product_name for item in order.items]}")
    return orders


# Новый endpoint для обработки вебхуков Telegram
@app.post("/webhook")
async def handle_webhook(update: WebhookUpdate, db: Session = Depends(get_db)):
    try:
        if update.pre_checkout_query:
            query = update.pre_checkout_query
            if not query.invoice_payload.startswith("order_"):
                return {"ok": False, "error_code": 400, "description": "Invalid payload"}
            
            cart_items = db.query(models.CartItem).filter(models.CartItem.user_id == query.from_user["id"]).all()
            if not cart_items:
                return {"ok": False, "error_code": 400, "description": "Cart is empty"}
            
            async with aiohttp.ClientSession() as session:
                await session.post(
                    f"https://api.telegram.org/bot{bot_token}/answerPreCheckoutQuery",
                    json={"pre_checkout_query_id": query.id, "ok": True}
                )
            return {"ok": True}
        if update.message and update.message.get("successful_payment"):
            payment = update.message["successful_payment"]
            order_id = payment["order_info"].get("payload", "").split("_")[1]
            db_order = db.query(models.Order).filter(models.Order.user_id == order_id).order_by(models.Order.order_date.desc()).first()
            if db_order:
                db_order.status = "Оплачено"
                db.commit()
                print(f"Order {order_id} paid")

            if db_order:
               db_order.status = "Оплачено"
        
               # Удаляем корзину после успешной оплаты
               db.query(models.CartItem).filter(models.CartItem.user_id == db_order.user_id).delete()
        
               db.commit()
               print(f"Order {order_id} paid и корзина очищена")
            return {"ok": True}

        return {"ok": True}
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        return {"ok": False, "error_code": 500, "description": str(e)}
    

@app.post("/payment-success")
async def payment_success(payment_data: dict, db: Session = Depends(get_db)):
    try:
        print(f"Эндпоинт /payment-success вызван с данными: {payment_data}")
        
        # Проверяем обязательные поля
        if not all(k in payment_data for k in ["payment_intent", "user_id"]):
            print("Ошибка: Не хватает обязательных данных")
            raise HTTPException(400, "Не хватает обязательных данных")

        # Проверяем платеж в Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_data["payment_intent"])
        print(f"Статус PaymentIntent {payment_data['payment_intent']}: {payment_intent.status}")
        if payment_intent.status != 'succeeded':
            print("Ошибка: Платеж не подтверждён в Stripe")
            raise HTTPException(400, "Платеж не подтверждён в Stripe")

        # Находим заказ
        query = db.query(models.Order)\
                .filter(
                    models.Order.user_id == payment_data["user_id"],
                    models.Order.status == "Ожидает оплаты",
                    models.Order.payment_method == "Карта"
                )
        if "order_id" in payment_data:
            query = query.filter(models.Order.id == payment_data["order_id"])
        order = query.order_by(models.Order.order_date.desc()).first()
        
        if not order:
            print(f"Заказ не найден для user_id: {payment_data['user_id']}, order_id: {payment_data.get('order_id', 'не указан')}")
            raise HTTPException(404, "Не найден заказ для оплаты")
        print(f"Найден заказ #{order.id} для user_id: {payment_data['user_id']}")

        # Обновляем заказ
        order.status = "Оплачено"
        order.payment_date = datetime.datetime.now()
        db.commit()
        print(f"Заказ #{order.id} обновлён: статус = Оплачено, payment_date = {order.payment_date}")

        # Очищаем корзину
        deleted_count = db.query(models.CartItem)\
                        .filter(models.CartItem.user_id == payment_data["user_id"])\
                        .delete()
        db.commit()
        print(f"Корзина очищена, удалено {deleted_count} элементов")

        # Отправляем уведомление
        await send_payment_notification_with_retry(order, db)
        print(f"Уведомление для заказа #{order.id} отправлено админу")

        return {"status": "success", "order_id": order.id}

    except HTTPException as he:
        print(f"HTTP ошибка: {he.detail}")
        raise he
    except Exception as e:
        db.rollback()
        print(f"Ошибка сервера: {traceback.format_exc()}")
        raise HTTPException(500, f"Внутренняя ошибка сервера: {str(e)}")
    
async def send_payment_notification_with_retry(order: models.Order, db: Session, max_retries: int = 3):
    for attempt in range(max_retries):
        try:
            db.refresh(order)
            items = db.query(models.OrderItem)\
                    .join(models.Product)\
                    .filter(models.OrderItem.order_id == order.id)\
                    .all()
            items_text = "\n".join(f"• {item.product.name} - {item.quantity} × {item.price} ₽" for item in items)
            message = (
                "💳 <b>ПЛАТЕЖ ПОЛУЧЕН</b>\n\n"
                f"🆔 Номер: #{order.id}\n"
                f"👤 Клиент: {order.user_id}\n"
                f"📞 Телефон: {order.phone}\n"
                f"💰 Сумма: {order.total} ₽\n"
                f"⏱ Дата оплаты: {order.payment_date}\n\n"
                f"<b>Состав заказа:</b>\n{items_text}\n\n"
                f"🏠 Адрес: {order.address}\n"
                f"🚚 Доставка: {order.delivery_method}\n"
                f"✅ Статус: {order.status}"
            )
            print(f"Попытка {attempt+1}: Отправляем уведомление: {message}")
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={
                        "chat_id": admin_chat_id,
                        "text": message,
                        "parse_mode": "HTML",
                        "disable_web_page_preview": True
                    },
                    timeout=10
                ) as resp:
                    response_data = await resp.json()
                    print(f"Ответ Telegram API (попытка {attempt+1}): {response_data}")
                    if resp.status == 200:
                        print("Уведомление об оплате успешно отправлено")
                        return True
                    else:
                        print(f"Ошибка Telegram API (попытка {attempt+1}): {response_data}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
        except Exception as e:
            print(f"Ошибка отправки уведомления (попытка {attempt+1}): {str(e)}")
            if attempt == max_retries - 1:
                raise
    return False
   

@app.post("/create-payment-intent/{user_id}")
async def create_payment_intent(user_id: str, db: Session = Depends(get_db)):
    print(f"Получен запрос на создание PaymentIntent для user_id: {user_id}")
    try:
        cart_items = db.query(models.CartItem).filter(models.CartItem.user_id == user_id).all()
        if not cart_items:
            print("Корзина пуста")
            raise HTTPException(status_code=400, detail="Cart is empty")

        total = sum(item.product.price * item.quantity for item in cart_items) * 100
        print(f"Сумма заказа: {total} центов")

        intent = stripe.PaymentIntent.create(
            amount=int(total),
            currency="usd",
            payment_method_types=["card"],
            metadata={"user_id": user_id}
        )
        print(f"PaymentIntent создан: {intent.id}")
        return JSONResponse({
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id
        })
    except Exception as e:
        print(f"Ошибка создания PaymentIntent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка создания платежа: {str(e)}")

