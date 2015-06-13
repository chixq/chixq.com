.PHONY: new build deploy run
empty:=
space:=$(empty) $(empty)
TITLE=$(subst $(space),-,$(T))
DATE=$(shell date +%Y-%m-%d)
new:
	mkdir -p contents/articles/$(TITLE);\
	echo "---" > contents/articles/$(TITLE)/index.md;\
	echo 'title: "$(T)"' >> contents/articles/$(TITLE)/index.md;\
	echo 'author: Kris' >> contents/articles/$(TITLE)/index.md;\
	echo 'date: $(DATE)' >> contents/articles/$(TITLE)/index.md;\
	echo 'template: article.jade' >> contents/articles/$(TITLE)/index.md;\
	echo '---' >> contents/articles/$(TITLE)/index.md;\
	vim contents/articles/$(TITLE)/index.md

run:
	wintersmith preview

build:
	wintersmith build

deploy: build
	@echo "Starting to deploy to Github..."
	cd build;\
	git add .;\
	git commit -am "New article: $(T)";\
	git push
