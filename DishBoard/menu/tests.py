from django.test import TestCase
from rest_framework.test import APIClient
from restaurant.models import Restaurant
from .models import Category, Item


class MenuContractTests(TestCase):
    def test_categories_include_items_in_two_queries_and_preserve_restaurant(self):
        client = APIClient()
        restaurant = Restaurant.objects.create(name="One", city="Haifa", address="1")
        other = Restaurant.objects.create(name="Two", city="Haifa", address="2")
        category = Category.objects.create(name="Main", restaurant=restaurant)
        item = Item.objects.create(name="Dish", category=category, price="12.50")
        Category.objects.create(name="Sides", restaurant=restaurant)
        with self.assertNumQueries(2):
            response = client.get(f"/api/menu/category/?restaurant_id={restaurant.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["items"][0]["id"], item.id)
        self.assertEqual(response.data[0]["items"][0]["price"], "12.50")
        response = client.patch(f"/api/menu/category/{category.id}/", {"name": "Updated", "restaurant": other.id})
        self.assertEqual(response.status_code, 200)
        category.refresh_from_db()
        self.assertEqual(category.restaurant_id, restaurant.id)
        self.assertEqual(client.get("/api/menu/category/").status_code, 400)
        self.assertEqual(client.get("/api/menu/item/").status_code, 405)

    def test_category_and_item_crud(self):
        client = APIClient()
        restaurant = Restaurant.objects.create(name="One", city="Haifa", address="1")
        category = client.post("/api/menu/category/", {"name": "Main", "restaurant": restaurant.id})
        self.assertEqual(category.status_code, 201)
        response = client.post("/api/menu/item/", {"name": "Dish", "category": category.data["id"], "price": "12.50"})
        self.assertEqual(response.status_code, 201)
        endpoint = f"/api/menu/item/{response.data['id']}/"
        self.assertEqual(client.get(endpoint).status_code, 200)
        self.assertEqual(client.patch(endpoint, {"price": "15.00"}).data["price"], "15.00")
        self.assertEqual(client.delete(endpoint).status_code, 204)
        self.assertEqual(client.delete(f"/api/menu/category/{category.data['id']}/").status_code, 204)
