from sqlalchemy.orm import Session
import models, database

def init_db():
    db = next(database.get_db())
    products = [
        {
            "name": "Смартфон",
            "price": 29990.0,
            "img": "/static/images/smartphone.png",
            "category": "electronics",
            "user_id": None
        },
        {
            "name": "Футболка",
            "price": 1990.0,
            "img": "/static/images/tshirt.png",
            "category": "clothing",
            "user_id": None
        },
        {
            "name": "Наушники",
            "price": 5990.0,
            "img": "/static/images/headphones.png",
            "category": "electronics",
            "user_id": None
        },
    ]
    for product in products:
        existing_product = db.query(models.Product).filter(models.Product.name == product["name"]).first()
        if not existing_product:
            db_product = models.Product(**product)
            db.add(db_product)
    db.commit()

    admins = [
        {"user_id": "test_admin_id", "is_admin": True},
        {"user_id": "7932759010", "is_admin": True},
        {"user_id": "test_user", "is_admin": True}
    ]
    for admin in admins:
        existing_admin = db.query(models.Admin).filter(models.Admin.user_id == admin["user_id"]).first()
        if not existing_admin:
            db_admin = models.Admin(**admin)
            db.add(db_admin)
    db.commit()

if __name__ == "__main__":
    models.Base.metadata.create_all(bind=database.engine)
    init_db()