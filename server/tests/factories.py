"""Test data factories using factory-boy for the User and OAuthAccount models."""

import uuid

import factory

from app.models.user import OAuthAccount, User


class UserFactory(factory.Factory):
    """Factory for creating User instances with realistic faker data.

    Uses factory.Factory (not SQLAlchemyModelFactory) to avoid session
    coupling — tests persist via the async `db` fixture when needed.
    """

    class Meta:
        model = User

    id = factory.LazyFunction(uuid.uuid4)
    email = factory.Faker("email")
    display_name = factory.Faker("first_name")
    avatar_url = None
    hashed_password = "hashed_placeholder"
    is_active = True
    is_verified = False
    is_superuser = False


class OAuthAccountFactory(factory.Factory):
    """Factory for creating OAuthAccount instances."""

    class Meta:
        model = OAuthAccount

    id = factory.LazyFunction(uuid.uuid4)
    user_id = factory.LazyFunction(uuid.uuid4)
    oauth_name = "google"
    access_token = factory.Faker("sha256")
    account_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    account_email = factory.Faker("email")
