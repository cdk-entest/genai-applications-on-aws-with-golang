import os
# import boto3

# parameters
REGION = "us-west-2"
ACCOUNT = os.environ["ACCOUNT_ID"]

# delete all docker images
os.system("sudo docker system prune -a")

# build go-bedrock-app image
os.system("sudo docker build -t go-bedrock-app . ")

#  aws ecr login
os.system(
    f"aws ecr get-login-password --region {REGION} | sudo docker login --username AWS --password-stdin {ACCOUNT}.dkr.ecr.{REGION}.amazonaws.com"
)

# get image id
IMAGE_ID = os.popen("sudo docker images -q go-bedrock-app:latest").read()

# tag go-bedrock-app image
os.system(
    f"sudo docker tag {IMAGE_ID.strip()} {ACCOUNT}.dkr.ecr.{REGION}.amazonaws.com/go-bedrock-app:latest"
)

# create ecr repository
os.system(
    f"aws ecr create-repository --registry-id {ACCOUNT} --repository-name go-bedrock-app --region {REGION}"
)

# push image to ecr
os.system(
    f"sudo docker push {ACCOUNT}.dkr.ecr.{REGION}.amazonaws.com/go-bedrock-app:latest"
)

# run locally to test
# os.system(f"sudo docker run -d -p 3001:3000 go-bedrock-app:latest")


# def update_service():
#     """
#     update service
#     """
#     # cluster
#     ecs = boto3.client("ecs", region_name=REGION)
#     cluster = "EcsClusterForNextApps"
#     # update service
#     response = ecs.update_service(
#         cluster=cluster,
#         service="",
#         forceNewDeployment=True,
#     )
#     print(response)
# update_service()